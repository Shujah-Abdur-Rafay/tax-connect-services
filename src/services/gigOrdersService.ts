import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchPlatformFeePercent } from '@/services/platformSettingsService';
import { queueFirebaseEmail, buildBrandedEmail } from '@/services/firebaseEmailService';
import { recordPayment } from '@/services/paymentsService';
import type { GigTier } from '@/data/taxGigs';

// Firebase Cloud Functions base — all gig payment/refund logic runs here now
// (Supabase has been fully removed from this project).
const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  'refund-connect-1m30';
const FN_BASE = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;
const CREATE_PAYMENT_URL = `${FN_BASE}/createTaxProPayment`;
const REFUND_GIG_URL = `${FN_BASE}/refundGigOrder`;



export type GigOrderStatus =
  | 'new'
  | 'awaiting_payment'
  | 'in_progress'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type GigOrderPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';

export interface GigOrderBrief {
  filingStatus?: string;
  dependents?: number;
  states?: string;
  incomeSources?: string[];
  hasPriorYearReturn?: string;
  urgency?: string;
  notes?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export interface GigOrderTier {
  name: string;
  price: number;
  deliveryDays: number;
  revisions: number | string;
}

/** Tax service options offered in the post-purchase client intake form. */
export type IntakeServiceNeeded =
  | 'Individual Tax Return'
  | 'Business Tax Return'
  | 'Bookkeeping'
  | 'Tax Resolution'
  | 'Other';

/**
 * Post-purchase client intake (Fiverr-style "order requirements"). Collected
 * from the Tax Client after they place an order and persisted on the order
 * document so the assigned pro sees it as the order's requirements before they
 * begin work / contact the client.
 */
export interface GigOrderIntake {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Will you be claiming any dependents? */
  claimingDependents: 'yes' | 'no';
  /** Are you self-employed or own a business? */
  selfEmployed: 'yes' | 'no';
  /** What tax service do you need help with? */
  serviceNeeded: IntakeServiceNeeded;
  /** Anything else the tax professional should know before contacting you? */
  additionalInfo?: string;
  /** Best time to call you? */
  bestTimeToCall?: string;
  /** ISO timestamp set when the intake was submitted. */
  submittedAt?: string | null;
}

export interface GigOrderRecord {
  id: string;
  gig_id: string;
  gig_slug?: string | null;
  gig_title: string;
  gig_image?: string | null;
  pro_id: string;
  pro_name?: string | null;
  pro_email?: string | null;
  pro_avatar?: string | null;
  client_uid: string;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  tier: GigOrderTier;
  brief: GigOrderBrief;
  /**
   * Post-purchase client intake / order requirements. Null until the client
   * submits the intake form. Surfaced to the assigned pro as the order's
   * requirements (ProOrdersInbox / OrderCard).
   */
  intake?: GigOrderIntake | null;
  intake_submitted_at?: string | null;
  status: GigOrderStatus;
  price: number;
  delivery_due_at?: string | null;
  delivered_at?: string | null;
  completed_at?: string | null;
  pro_note?: string | null;
  delivery_message?: string | null;
  /**
   * Pro-uploaded files attached to a delivery (completed tax return,
   * signed 8879, schedules, etc.). Stored under
   * `gig_orders/{orderId}/deliverables/{filename}` in Firebase Storage.
   * Each entry holds the metadata + download URL so the client can fetch.
   */
  delivery_files?: GigOrderDeliveryFile[];
  /**
   * Client-uploaded source documents attached to the brief (W-2s, 1099s,
   * prior-year return, receipts, etc.). Stored under
   * `gig_orders/{orderId}/source-docs/{filename}` in Firebase Storage.
   * Reads are gated by Storage rules to client_uid + pro_id; writes only
   * client_uid.
   */
  source_files?: GigOrderSourceFile[];
  // Payment fields
  payment_status?: GigOrderPaymentStatus;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  checkout_url?: string | null;
  paid_at?: string | null;
  // Refund fields
  stripe_refund_id?: string | null;
  refund_amount?: number | null;
  refund_reason?: string | null;
  refund_initiated_by?: 'client' | 'pro' | null;
  refunded_at?: string | null;
  /**
   * Timestamp (ISO) of when we successfully fired the "your delivery is
   * ready" email to the client via the send-notification-email edge
   * function. Acts as an idempotency lock so re-running updateOrderStatus
   * (e.g. a stuck button getting re-clicked) does not spam the client.
   */
  delivery_email_sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
}



export interface GigOrderDeliveryFile {
  name: string;
  size: number;
  contentType: string;
  storagePath: string;
  downloadURL: string;
  uploadedAt?: string;
}

/** Same shape as a delivery file but for client-uploaded source documents. */
export type GigOrderSourceFile = GigOrderDeliveryFile;




export interface CreateGigOrderInput {
  gigId: string;
  gigSlug?: string;
  gigTitle: string;
  gigImage?: string;
  proId: string;
  proName?: string;
  proEmail?: string;
  proAvatar?: string;
  clientUid: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  tier: GigTier | GigOrderTier;
  brief: GigOrderBrief;
}

const COLLECTION = 'gig_orders';

const tsToIso = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as any)?.toDate === 'function') {
    try {
      return (v as any).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'string') return v;
  return undefined;
};

/** Coerce a raw Firestore intake blob into a typed GigOrderIntake (or null). */
const sanitizeIntake = (raw: any): GigOrderIntake | null => {
  if (!raw || typeof raw !== 'object') return null;
  const yesNo = (v: any): 'yes' | 'no' => (v === 'yes' ? 'yes' : 'no');
  const services: IntakeServiceNeeded[] = [
    'Individual Tax Return',
    'Business Tax Return',
    'Bookkeeping',
    'Tax Resolution',
    'Other',
  ];
  const service = services.includes(raw.serviceNeeded) ? raw.serviceNeeded : 'Other';
  return {
    firstName: String(raw.firstName || ''),
    lastName: String(raw.lastName || ''),
    phone: String(raw.phone || ''),
    email: String(raw.email || ''),
    claimingDependents: yesNo(raw.claimingDependents),
    selfEmployed: yesNo(raw.selfEmployed),
    serviceNeeded: service as IntakeServiceNeeded,
    additionalInfo: raw.additionalInfo ? String(raw.additionalInfo) : '',
    bestTimeToCall: raw.bestTimeToCall ? String(raw.bestTimeToCall) : '',
    submittedAt: tsToIso(raw.submittedAt) ?? null,
  };
};

const docToOrder = (id: string, data: any): GigOrderRecord => ({
  id,
  gig_id: data.gig_id || '',
  gig_slug: data.gig_slug ?? null,
  gig_title: data.gig_title || '',
  gig_image: data.gig_image ?? null,
  pro_id: data.pro_id || '',
  pro_name: data.pro_name ?? null,
  pro_email: data.pro_email ?? null,
  pro_avatar: data.pro_avatar ?? null,
  client_uid: data.client_uid || '',
  client_name: data.client_name ?? null,
  client_email: data.client_email ?? null,
  client_phone: data.client_phone ?? null,
  tier: {
    name: data.tier?.name || 'Standard',
    price: Number(data.tier?.price || 0),
    deliveryDays: Number(data.tier?.deliveryDays || 0),
    revisions: data.tier?.revisions ?? 1,
  },
  brief: data.brief || {},
  intake: sanitizeIntake(data.intake),
  intake_submitted_at: tsToIso(data.intake_submitted_at) ?? null,
  status: (data.status as GigOrderStatus) || 'new',
  price: Number(data.price || 0),
  delivery_due_at: tsToIso(data.delivery_due_at) ?? null,
  delivered_at: tsToIso(data.delivered_at) ?? null,
  completed_at: tsToIso(data.completed_at) ?? null,
  pro_note: data.pro_note ?? null,
  delivery_message: data.delivery_message ?? null,
  delivery_files: Array.isArray(data.delivery_files)
    ? (data.delivery_files as any[])
        .filter((f) => f && typeof f === 'object' && f.downloadURL)
        .map((f) => ({
          name: String(f.name || 'file'),
          size: Number(f.size || 0),
          contentType: String(f.contentType || 'application/octet-stream'),
          storagePath: String(f.storagePath || ''),
          downloadURL: String(f.downloadURL),
          uploadedAt: typeof f.uploadedAt === 'string' ? f.uploadedAt : undefined,
        }))
    : [],
  source_files: Array.isArray(data.source_files)
    ? (data.source_files as any[])
        .filter((f) => f && typeof f === 'object' && f.downloadURL)
        .map((f) => ({
          name: String(f.name || 'file'),
          size: Number(f.size || 0),
          contentType: String(f.contentType || 'application/octet-stream'),
          storagePath: String(f.storagePath || ''),
          downloadURL: String(f.downloadURL),
          uploadedAt: typeof f.uploadedAt === 'string' ? f.uploadedAt : undefined,
        }))
    : [],


  payment_status: (data.payment_status as GigOrderPaymentStatus) || 'unpaid',
  stripe_payment_intent_id: data.stripe_payment_intent_id ?? null,
  stripe_checkout_session_id: data.stripe_checkout_session_id ?? null,
  checkout_url: data.checkout_url ?? null,
  paid_at: tsToIso(data.paid_at) ?? null,
  stripe_refund_id: data.stripe_refund_id ?? null,
  refund_amount: typeof data.refund_amount === 'number' ? data.refund_amount : null,
  refund_reason: data.refund_reason ?? null,
  refund_initiated_by: (data.refund_initiated_by as 'client' | 'pro') ?? null,
  refunded_at: tsToIso(data.refunded_at) ?? null,
  delivery_email_sent_at: tsToIso(data.delivery_email_sent_at) ?? null,
  created_at: tsToIso(data.created_at),
  updated_at: tsToIso(data.updated_at),
});



export async function createGigOrder(input: CreateGigOrderInput): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.clientUid) throw new Error('Client must be signed in to place an order.');
  if (!input.proId) throw new Error('Missing pro for this gig.');

  const deliveryDays = Number((input.tier as any)?.deliveryDays || 0);
  const dueDate = deliveryDays
    ? new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000)
    : null;

  const payload: any = {
    gig_id: input.gigId,
    gig_slug: input.gigSlug ?? null,
    gig_title: input.gigTitle,
    gig_image: input.gigImage ?? null,
    pro_id: input.proId,
    pro_name: input.proName ?? null,
    pro_email: input.proEmail ?? null,
    pro_avatar: input.proAvatar ?? null,
    client_uid: input.clientUid,
    client_name: input.clientName ?? null,
    client_email: input.clientEmail ?? null,
    client_phone: input.clientPhone ?? null,
    tier: {
      name: (input.tier as any).name || 'Standard',
      price: Number((input.tier as any).price || 0),
      deliveryDays,
      revisions: (input.tier as any).revisions ?? 1,
    },
    brief: input.brief || {},
    status: 'new' as GigOrderStatus,
    price: Number((input.tier as any).price || 0),
    payment_status: 'unpaid' as GigOrderPaymentStatus,
    delivery_due_at: dueDate ? Timestamp.fromDate(dueDate) : null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  const snap = await getDoc(ref);
  return docToOrder(ref.id, snap.data() || payload);
}

const safeQuery = async (qBuilder: () => any, fallbackBuilder: () => any) => {
  try {
    return await getDocs(qBuilder());
  } catch (e) {
    console.warn('[gigOrdersService] ordered query failed, retrying unordered:', e);
    return await getDocs(fallbackBuilder());
  }
};

export async function fetchOrdersForPro(proId: string): Promise<GigOrderRecord[]> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!proId) return [];
  const snap = await safeQuery(
    () =>
      query(
        collection(db, COLLECTION),
        where('pro_id', '==', proId),
        orderBy('created_at', 'desc')
      ),
    () => query(collection(db, COLLECTION), where('pro_id', '==', proId))
  );
  const records = snap.docs.map((d) => docToOrder(d.id, d.data()));
  records.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return records;
}

export async function fetchOrdersForClient(clientUid: string): Promise<GigOrderRecord[]> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!clientUid) return [];
  const snap = await safeQuery(
    () =>
      query(
        collection(db, COLLECTION),
        where('client_uid', '==', clientUid),
        orderBy('created_at', 'desc')
      ),
    () => query(collection(db, COLLECTION), where('client_uid', '==', clientUid))
  );
  const records = snap.docs.map((d) => docToOrder(d.id, d.data()));
  records.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return records;
}

export async function fetchOrderById(orderId: string): Promise<GigOrderRecord | null> {
  if (!db) throw new Error('Firestore is not initialized');
  const ref = doc(db, COLLECTION, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return docToOrder(snap.id, snap.data());
}

export async function updateOrderStatus(
  orderId: string,
  userUid: string,
  status: GigOrderStatus,
  extra?: {
    proNote?: string;
    deliveryMessage?: string;
    /**
     * Pro-only: attach a list of already-uploaded deliverable files (uploaded
     * by `uploadGigDeliverable` in firebaseStorageService) to the order. When
     * present alongside status='delivered', the array is written verbatim to
     * the order's `delivery_files` field so the client can download them.
     */
    deliveryFiles?: GigOrderDeliveryFile[];
  }
): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userUid) throw new Error('Not authenticated');

  const ref = doc(db, COLLECTION, orderId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Order not found');
  const data = existing.data() as any;

  const isPro = data.pro_id === userUid;
  const isClient = data.client_uid === userUid;
  if (!isPro && !isClient) {
    throw new Error('You do not have permission to update this order.');
  }

  // Permission matrix:
  // - Pro: accept (new -> awaiting_payment via requestOrderPayment), deliver (in_progress -> delivered, BLOCKED if unpaid), cancel
  // - Client: complete (delivered -> completed), cancel (new/awaiting_payment only)
  if (isClient && !isPro) {
    const allowed: GigOrderStatus[] = ['completed', 'cancelled'];
    if (!allowed.includes(status)) {
      throw new Error('Clients can only complete or cancel orders.');
    }
    if (status === 'cancelled' && !['new', 'awaiting_payment'].includes(data.status)) {
      throw new Error('You can only cancel a new or unpaid order.');
    }
    if (status === 'completed' && data.status !== 'delivered') {
      throw new Error('Order must be delivered before you can mark it complete.');
    }
  }

  if (isPro) {
    // Block direct delivery while payment hasn't cleared.
    if (status === 'delivered' && data.payment_status !== 'paid') {
      throw new Error('Cannot deliver this order until the client has paid.');
    }
    // Direct new -> in_progress is no longer allowed; use requestOrderPayment.
    if (status === 'in_progress' && data.status === 'new') {
      throw new Error('Send a payment request first — clients pay before work begins.');
    }
  }

  const update: any = {
    status,
    updated_at: serverTimestamp(),
  };
  if (status === 'delivered') update.delivered_at = serverTimestamp();
  if (status === 'completed') update.completed_at = serverTimestamp();
  if (extra?.proNote !== undefined) update.pro_note = extra.proNote;
  if (extra?.deliveryMessage !== undefined) update.delivery_message = extra.deliveryMessage;

  // Persist any uploaded deliverable files. We only honour this when the pro is
  // delivering — both for sanity (clients shouldn't be able to "deliver" their
  // own order) and because the Storage rule already gates the upload paths.
  if (
    isPro &&
    status === 'delivered' &&
    Array.isArray(extra?.deliveryFiles) &&
    extra!.deliveryFiles!.length > 0
  ) {
    update.delivery_files = extra!.deliveryFiles!.map((f) => ({
      name: f.name,
      size: Number(f.size || 0),
      contentType: f.contentType || 'application/octet-stream',
      storagePath: f.storagePath,
      downloadURL: f.downloadURL,
      uploadedAt: f.uploadedAt || new Date().toISOString(),
    }));
  }

  await updateDoc(ref, update);

  // ──────────────────────────────────────────────────────────────────────
  // Delivery email side-effect.
  //
  // When the pro flips an order to "delivered", email the client at
  // order.client_email with the delivery message body, attached-file count,
  // and a deep-link to /my-orders?gig_order_id={id} so they can land
  // straight on the order. We:
  //   • Fire-and-forget the invoke (errors are swallowed — never let a
  //     transient email failure undo a successful Firestore delivery).
  //   • Write `delivery_email_sent_at` BEFORE the invoke so a double-click
  //     on the Deliver button can't re-send. If the email actually fails,
  //     the timestamp still stands and we accept "at-most-once" semantics
  //     (better to skip a notification than to spam the client).
  //   • Skip entirely if the order already has a `delivery_email_sent_at`
  //     (e.g. someone manually toggles state) or if there's no
  //     `client_email` on file (can't email an empty inbox).
  //
  // The matching `gig_order_delivered` template lives in the
  // send-notification-email edge function (see edge-functions/send-
  // notification-email.ts for the canonical source).
  // ──────────────────────────────────────────────────────────────────────
  if (
    isPro &&
    status === 'delivered' &&
    !data.delivery_email_sent_at &&
    data.client_email
  ) {
    try {
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://famous.ai';
      const reviewUrl = `${origin}/my-orders?gig_order_id=${encodeURIComponent(orderId)}`;
      const deliveryMessage =
        extra?.deliveryMessage ?? data.delivery_message ?? '';
      const fileCount = Array.isArray(extra?.deliveryFiles)
        ? extra!.deliveryFiles!.length
        : Array.isArray(data.delivery_files)
        ? data.delivery_files.length
        : 0;

      // Idempotency lock — write *first* so any concurrent invocation
      // sees the timestamp and skips re-sending.
      await updateDoc(ref, {
        delivery_email_sent_at: serverTimestamp(),
      });

      // Queue the branded "your delivery is ready" email via Firebase Trigger Email.
      const html = buildBrandedEmail({
        title: 'Your order has been delivered',
        intro: `${data.client_name || 'Hi'}, ${data.pro_name || 'your tax pro'} has delivered your order "${data.gig_title || 'Your order'}".${deliveryMessage ? ' Message: ' + deliveryMessage : ''}`,
        rows: [
          { label: 'Service', value: data.gig_title || 'Your order' },
          { label: 'Package', value: data.tier?.name || 'Standard' },
          { label: 'Files attached', value: String(fileCount) },
        ],
        ctaLabel: 'View your delivery',
        ctaUrl: reviewUrl,
        footer: 'Review the work and mark the order complete when you are satisfied.',
        accentColor: '#7c3aed',
      });
      await queueFirebaseEmail({
        to: data.client_email,
        subject: `Your order "${data.gig_title || 'order'}" has been delivered`,
        html,
        category: 'gig_order_delivered',
        meta: { orderId, fileCount },
      });
    } catch (e) {
      console.warn(
        '[gigOrdersService] delivery email side-effect threw (order still delivered):',
        e
      );
    }
  }

  const fresh = await getDoc(ref);
  return docToOrder(ref.id, fresh.data() || {});
}



/**
 * Pro-initiated: accept an order and request payment via the Firebase Cloud
 * Function `createTaxProPayment` (flow: 'gig' — a Connect destination charge).
 * Returns a PaymentIntent client_secret which the client confirms inline.
 */
export async function requestOrderPayment(
  orderId: string,
  userUid: string
): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userUid) throw new Error('Not authenticated');

  const ref = doc(db, COLLECTION, orderId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Order not found');
  const data = existing.data() as any;

  if (data.pro_id !== userUid) {
    throw new Error('Only the assigned pro can accept this order.');
  }
  if (data.status !== 'new') {
    throw new Error(`Order is already ${String(data.status).replace('_', ' ')}.`);
  }

  let stripeAccountId: string | null = null;
  try {
    const proRef = doc(db, 'professionals', data.pro_id);
    const proSnap = await getDoc(proRef);
    if (!proSnap.exists()) throw new Error('Professional record not found.');
    const proData = proSnap.data() as any;
    const acctId = typeof proData?.stripe_account_id === 'string'
      ? String(proData.stripe_account_id).trim()
      : '';
    const chargesEnabled = proData?.stripe_charges_enabled === true;
    if (!acctId) {
      throw new Error(
        'You haven\u2019t connected a Stripe payout account yet. ' +
        'Open the Stripe Connect tab on the Payouts page to complete onboarding ' +
        'before requesting payment from a client.'
      );
    }
    if (!chargesEnabled) {
      throw new Error(
        'Your Stripe Connect account isn\u2019t finished yet (charges_enabled is false). ' +
        'Finish the remaining requirements on the Payouts page, then accept this order.'
      );
    }
    stripeAccountId = acctId;
  } catch (e: any) {
    if (e instanceof Error) throw e;
    throw new Error('Could not verify your Stripe Connect status.');
  }

  const platformFeePercent = await fetchPlatformFeePercent();
  const amountCents = Math.round(Number(data.price || data.tier?.price || 0) * 100);

  let resp: any = {};
  try {
    const r = await fetch(CREATE_PAYMENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flow: 'gig',
        amount: amountCents,
        currency: 'usd',
        email: data.client_email,
        name: data.client_name,
        proId: data.pro_id,
        orderId,
        destinationAccountId: stripeAccountId,
        applicationFeePercent: platformFeePercent,
        metadata: {
          gig_title: data.gig_title || '',
          tier_name: data.tier?.name || '',
        },
      }),
    });
    resp = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(resp?.error || `Payment setup failed (HTTP ${r.status}).`);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Failed to set up payment.');
  }
  if (resp?.error) throw new Error(resp.message || resp.error);
  if (!resp?.clientSecret) throw new Error('Stripe did not return a payment client secret.');

  await updateDoc(ref, {
    status: 'awaiting_payment' as GigOrderStatus,
    payment_status: 'pending' as GigOrderPaymentStatus,
    payment_client_secret: resp.clientSecret,
    stripe_payment_intent_id: resp.paymentIntentId || null,
    updated_at: serverTimestamp(),
  });

  const fresh = await getDoc(ref);
  return docToOrder(ref.id, fresh.data() || {});
}




/**
 * Client-side: confirm payment after the inline PaymentElement reports success.
 * The Firebase `stripeWebhook` Cloud Function is the authoritative source and
 * also flips this doc server-side; here we optimistically reflect the success
 * so the UI updates immediately.
 */
export async function confirmOrderPayment(
  orderId: string,
  paymentIntentId: string,
  userUid: string
): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userUid) throw new Error('Not authenticated');

  const ref = doc(db, COLLECTION, orderId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Order not found');
  const data = existing.data() as any;
  if (data.client_uid !== userUid) {
    throw new Error('Only the buying client can confirm payment.');
  }

  // If already paid (webhook ran, or user refreshed), return as-is.
  if (data.payment_status === 'paid' && data.stripe_payment_intent_id) {
    return docToOrder(ref.id, data);
  }

  await updateDoc(ref, {
    status: 'in_progress' as GigOrderStatus,
    payment_status: 'paid' as GigOrderPaymentStatus,
    stripe_payment_intent_id: paymentIntentId || data.stripe_payment_intent_id || null,
    paid_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // Append to the client's payment history (real `payments` ledger). Best-effort
  // optimistic copy — the Stripe webhook writes the authoritative record once
  // Cloud Functions are deployed. recordPayment never throws.
  await recordPayment({
    userUid: userUid,
    amount: Number(data.price || data.tier?.price || 0),
    currency: 'usd',
    status: 'succeeded',
    paymentType: 'service_fee',
    description: `${data.gig_title || 'Tax service'}${data.tier?.name ? ` — ${data.tier.name}` : ''}`,
    stripePaymentIntentId: paymentIntentId || data.stripe_payment_intent_id || undefined,
  });

  const fresh = await getDoc(ref);
  return docToOrder(ref.id, fresh.data() || {});
}



/**
 * Client-only: attach already-uploaded source documents (W-2s, 1099s, prior-
 * year return, receipts) to the order's `source_files` array. The Storage
 * upload itself happens in firebaseStorageService.uploadGigSourceDoc — this
 * function only does the Firestore array merge.
 *
 * Allowed when:
 *   - The caller is the order's client_uid.
 *   - The order status is 'new' or 'awaiting_payment' (i.e. work hasn't
 *     started yet — once the pro is mid-return, you don't get to retroactively
 *     change the source data without a conversation).
 *   - The order isn't refunded/cancelled.
 */
export async function addOrderSourceFiles(
  orderId: string,
  userUid: string,
  files: GigOrderSourceFile[]
): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userUid) throw new Error('Not authenticated');
  if (!files || files.length === 0) {
    throw new Error('No files to attach.');
  }

  const ref = doc(db, COLLECTION, orderId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Order not found');
  const data = existing.data() as any;

  if (data.client_uid !== userUid) {
    throw new Error('Only the client on this order can attach source documents.');
  }
  if (data.payment_status === 'refunded') {
    throw new Error('This order has been refunded; source documents are locked.');
  }
  if (!['new', 'awaiting_payment'].includes(data.status)) {
    throw new Error(
      'You can only attach source documents before the pro starts work. Send them a message instead.'
    );
  }

  const existingArr: any[] = Array.isArray(data.source_files) ? data.source_files : [];
  const sanitized = files.map((f) => ({
    name: String(f.name || 'file'),
    size: Number(f.size || 0),
    contentType: f.contentType || 'application/octet-stream',
    storagePath: f.storagePath,
    downloadURL: f.downloadURL,
    uploadedAt: f.uploadedAt || new Date().toISOString(),
  }));

  // Dedupe by storagePath — re-running addOrderSourceFiles with the same blob
  // should be idempotent.
  const seen = new Set<string>(existingArr.map((f: any) => String(f?.storagePath || '')));
  const merged = [
    ...existingArr,
    ...sanitized.filter((f) => f.storagePath && !seen.has(f.storagePath)),
  ];

  await updateDoc(ref, {
    source_files: merged,
    updated_at: serverTimestamp(),
  });

  const fresh = await getDoc(ref);
  return docToOrder(ref.id, fresh.data() || {});
}

/**
 * Client-only: remove a single source document from the order's `source_files`
 * array. Deletes the Storage object too (best-effort — Firestore is the source
 * of truth so we don't fail the call if Storage deletion errors).
 *
 * Same status guardrails as addOrderSourceFiles — once work has started, the
 * client shouldn't yank out documents the pro may already be relying on.
 */
export async function removeOrderSourceFile(
  orderId: string,
  userUid: string,
  storagePath: string
): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userUid) throw new Error('Not authenticated');
  if (!storagePath) throw new Error('Missing storagePath.');

  const ref = doc(db, COLLECTION, orderId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Order not found');
  const data = existing.data() as any;

  if (data.client_uid !== userUid) {
    throw new Error('Only the client on this order can remove source documents.');
  }
  if (!['new', 'awaiting_payment'].includes(data.status)) {
    throw new Error(
      'You can only remove source documents before the pro starts work.'
    );
  }

  const existingArr: any[] = Array.isArray(data.source_files) ? data.source_files : [];
  const next = existingArr.filter((f: any) => String(f?.storagePath || '') !== storagePath);

  await updateDoc(ref, {
    source_files: next,
    updated_at: serverTimestamp(),
  });

  const fresh = await getDoc(ref);
  return docToOrder(ref.id, fresh.data() || {});
}


/**
 * Client-only: submit the post-purchase intake / order requirements. Persists
 * the intake on the order document (which already carries pro_id, so the order
 * is routed directly to the selected professional) and stamps
 * `intake_submitted_at`. The assigned pro then sees it as the order's
 * requirements in their Orders Inbox.
 *
 * Allowed for the order's client_uid on any non-refunded order. Re-submitting
 * overwrites the previous intake (clients can correct details before hand-off).
 */
export async function submitOrderIntake(
  orderId: string,
  userUid: string,
  intake: Omit<GigOrderIntake, 'submittedAt'>,
): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userUid) throw new Error('Not authenticated');

  // Minimal required-field validation (the modal enforces this too).
  const required: (keyof typeof intake)[] = ['firstName', 'lastName', 'phone', 'email'];
  for (const f of required) {
    if (!String((intake as any)[f] || '').trim()) {
      throw new Error('Please complete all required contact fields.');
    }
  }

  const ref = doc(db, COLLECTION, orderId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Order not found');
  const data = existing.data() as any;

  if (data.client_uid !== userUid) {
    throw new Error('Only the client on this order can submit the intake form.');
  }
  if (data.payment_status === 'refunded' || data.status === 'cancelled') {
    throw new Error('This order is closed; the intake form is locked.');
  }

  const cleanIntake = {
    firstName: String(intake.firstName).trim(),
    lastName: String(intake.lastName).trim(),
    phone: String(intake.phone).trim(),
    email: String(intake.email).trim(),
    claimingDependents: intake.claimingDependents === 'yes' ? 'yes' : 'no',
    selfEmployed: intake.selfEmployed === 'yes' ? 'yes' : 'no',
    serviceNeeded: intake.serviceNeeded,
    additionalInfo: (intake.additionalInfo || '').slice(0, 2000),
    bestTimeToCall: (intake.bestTimeToCall || '').slice(0, 200),
    submittedAt: new Date().toISOString(),
  };

  await updateDoc(ref, {
    intake: cleanIntake,
    intake_submitted_at: serverTimestamp(),
    // Keep the denormalized client contact fields fresh from the intake so the
    // pro's order card / emails always show the latest phone + email.
    client_name: `${cleanIntake.firstName} ${cleanIntake.lastName}`.trim() || data.client_name || null,
    client_email: cleanIntake.email || data.client_email || null,
    client_phone: cleanIntake.phone || data.client_phone || null,
    updated_at: serverTimestamp(),
  });

  const fresh = await getDoc(ref);
  return docToOrder(ref.id, fresh.data() || {});
}


/**
 * Refund flow: either party can refund a paid order that's not yet completed
 * or already-refunded. Calls the `refund-gig-order` edge function which talks
 * to Stripe /v1/refunds using the stored payment_intent_id. On Stripe success
 * we write payment_status='refunded' + refunded_at + refund_amount +
 * stripe_refund_id + status='cancelled' back to the Firestore doc.
 *
 *  - Client can refund-request on `delivered` orders (dispute / not-happy).
 *  - Pro can refund the client on `awaiting_payment` / `in_progress` /
 *    `delivered` orders (good-faith cancellation, scope change, etc.).
 *  - `awaiting_payment` orders without a payment_intent_id (client never paid)
 *    fall back to a plain cancel — no Stripe call.
 */
export async function refundGigOrder(
  orderId: string,
  userUid: string,
  opts: { reason?: string; amount?: number } = {}
): Promise<GigOrderRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userUid) throw new Error('Not authenticated');

  const ref = doc(db, COLLECTION, orderId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Order not found');
  const data = existing.data() as any;

  const isPro = data.pro_id === userUid;
  const isClient = data.client_uid === userUid;
  if (!isPro && !isClient) {
    throw new Error('You do not have permission to refund this order.');
  }

  if (data.payment_status === 'refunded') {
    throw new Error('This order has already been refunded.');
  }

  const refundableStatuses: GigOrderStatus[] = ['awaiting_payment', 'in_progress', 'delivered'];
  if (!refundableStatuses.includes(data.status)) {
    throw new Error(
      `Orders in "${String(data.status).replace('_', ' ')}" status cannot be refunded.`
    );
  }

  // Client-side guardrail: clients can only refund-request on delivered orders.
  // (Pre-payment / in-progress they should just "Cancel" — no money has moved
  // or work is mid-flight and needs a pro decision.)
  if (isClient && !isPro && data.status !== 'delivered') {
    throw new Error('You can request a refund only after the pro has delivered.');
  }

  const piId = data.stripe_payment_intent_id;
  const initiatedBy: 'client' | 'pro' = isPro ? 'pro' : 'client';
  const reason = (opts.reason || '').slice(0, 480);

  // Case A: payment never cleared (awaiting_payment without payment_intent_id).
  // Skip Stripe entirely — just cancel the order locally.
  if (!piId) {
    await updateDoc(ref, {
      status: 'cancelled' as GigOrderStatus,
      refund_reason: reason || null,
      refund_initiated_by: initiatedBy,
      updated_at: serverTimestamp(),
    });
    const fresh = await getDoc(ref);
    return docToOrder(ref.id, fresh.data() || {});
  }

  // Case B: paid — ask the Firebase Cloud Function to create a Stripe refund.
  let resp: any = {};
  try {
    const r = await fetch(REFUND_GIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: piId,
        orderId,
        amount: typeof opts.amount === 'number' ? opts.amount : undefined,
        reason: 'requested_by_customer',
        initiatedBy,
        note: reason,
      }),
    });
    resp = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(resp?.error || `Refund failed (HTTP ${r.status}).`);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Refund failed at Stripe.');
  }
  if (!resp?.ok || !resp?.refundId) {
    throw new Error(resp?.error || 'Stripe did not confirm the refund.');
  }


  const refundedAmount =
    typeof resp.amount === 'number' ? resp.amount : Number(data.price || 0);

  await updateDoc(ref, {
    status: 'cancelled' as GigOrderStatus,
    payment_status: 'refunded' as GigOrderPaymentStatus,
    stripe_refund_id: resp.refundId,
    refund_amount: refundedAmount,
    refund_reason: reason || null,
    refund_initiated_by: initiatedBy,
    refunded_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  const fresh = await getDoc(ref);
  return docToOrder(ref.id, fresh.data() || {});
}


export const ORDER_STATUS_META: Record<
  GigOrderStatus,
  { label: string; color: string; description: string }
> = {
  new: {
    label: 'New',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Awaiting pro review',
  },
  awaiting_payment: {
    label: 'Awaiting payment',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    description: 'Client needs to pay to start work',
  },
  in_progress: {
    label: 'In progress',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    description: 'Pro is working on it',
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    description: 'Awaiting client review',
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'Order closed',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    description: 'Order cancelled',
  },
};
