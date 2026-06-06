// =============================================================================
// src/services/postPurchaseEmailService.ts
// =============================================================================
// Automatic post-purchase email pipeline.
//
// Fires off TWO transactional emails the instant a tax pro completes a
// membership upgrade (i.e. inside finalizeMembershipUpgrade):
//
//   1. membership-welcome           → to the tax pro (branded receipt, tier,
//                                     amount, Stripe receipt URL, next steps,
//                                     kickoff-call calendar link)
//   2. membership-sale-internal     → to the platform owner ("new sale" alert
//                                     with name / email / amount / Stripe link)
//
// Both are delivered through the existing Firebase Functions `sendEmail`
// HTTPS-callable (Gmail SMTP under the hood). NO Supabase. NO redirects.
//
// Every attempt — success OR failure — is written to Firestore
// `post_purchase_emails` so the owner has an audit log of what was actually
// delivered.
// =============================================================================

import { httpsCallable, getFunctions } from 'firebase/functions';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getApps } from 'firebase/app';
import { db } from '@/lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Config — these are safe to expose. Override at build time via Vite env vars
// when the platform owner wants the welcome email to point at a real
// scheduling page (Calendly, Famous CRM calendar, etc.).
// ─────────────────────────────────────────────────────────────────────────────

/** Where "new sale" alerts go. Falls back to the Gmail account that sends. */
const PLATFORM_OWNER_EMAIL =
  (import.meta.env.VITE_PLATFORM_OWNER_EMAIL as string | undefined) ||
  'gerald@refund-connect.com';

/** The hosted kickoff-call booking link embedded in the welcome email. */
const KICKOFF_CALENDAR_URL =
  (import.meta.env.VITE_KICKOFF_CALENDAR_URL as string | undefined) ||
  'https://refund-connect.com/support';

/** Where the welcome email's "Go to your dashboard" button points. */
const MEMBER_DASHBOARD_URL =
  (import.meta.env.VITE_MEMBER_DASHBOARD_URL as string | undefined) ||
  (typeof window !== 'undefined'
    ? `${window.location.origin}/member-portal`
    : 'https://refund-connect.com/member-portal');

/** Public support email shown in the welcome footer. */
const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ||
  'support@refund-connect.com';

/** Firebase project ID — must match the one the sendEmail callable is in. */
const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  'refund-connect-1m30';

/** Server-side receipt URL lookup (added in functions/src/index.ts). */
const GET_RECEIPT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/getPaymentReceipt`;

// ─────────────────────────────────────────────────────────────────────────────
// Public input shape
// ─────────────────────────────────────────────────────────────────────────────

export interface PostPurchaseEmailInput {
  /** The tax pro who just paid. */
  userId: string;
  userEmail: string;
  userName?: string;
  userPhone?: string;

  /** Human-readable tier name (e.g. "Professional", "Premier Partner"). */
  tierName: string;

  /** Amount actually charged, in cents. */
  amountCents: number;

  /** Stripe PaymentIntent id (used for receipt lookup + admin alert). */
  paymentIntentId?: string;

  /** Firestore doc id from membership_payment_attempts. */
  attemptDocId?: string;

  /** Promo code used at checkout, if any. */
  promoCode?: string;
  promoAmount?: number;
}

export interface PostPurchaseEmailResult {
  proEmailSent: boolean;
  ownerEmailSent: boolean;
  receiptUrl: string | null;
  logDocId: string | null;
  errors: { proEmailError?: string; ownerEmailError?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatUsd(cents: number): string {
  const dollars = (Number(cents) || 0) / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Look up the Stripe receipt URL from the PaymentIntent. */
async function fetchReceiptUrl(paymentIntentId: string): Promise<string | null> {
  try {
    const res = await fetch(GET_RECEIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.receiptUrl || null;
  } catch (err) {
    console.warn('[postPurchaseEmail] receipt lookup failed (non-fatal):', err);
    return null;
  }
}

/** Build the callable lazily — only when we actually need to send. */
function getSendEmailCallable() {
  if (!getApps().length) {
    throw new Error('Firebase app not initialized — cannot send post-purchase emails.');
  }
  // Region must match where the function was deployed. Default = us-central1.
  const functionsInstance = getFunctions(getApps()[0], 'us-central1');
  return httpsCallable(functionsInstance, 'sendEmail');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point — fire-and-forget safe.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends both the customer welcome email and the internal "new sale" alert.
 * Designed to be safe to await OR to call fire-and-forget — it never throws.
 * All errors are caught and recorded into Firestore so a flaky Gmail send
 * cannot break the upgrade flow.
 */
export async function sendPostPurchaseEmails(
  input: PostPurchaseEmailInput,
): Promise<PostPurchaseEmailResult> {
  const result: PostPurchaseEmailResult = {
    proEmailSent: false,
    ownerEmailSent: false,
    receiptUrl: null,
    logDocId: null,
    errors: {},
  };

  const amountFormatted = formatUsd(input.amountCents);
  const promoAmountFormatted =
    input.promoAmount && input.promoAmount > 0
      ? formatUsd(Math.round(input.promoAmount * 100))
      : undefined;

  // 1. Best-effort receipt URL lookup (does not block the email).
  if (input.paymentIntentId) {
    result.receiptUrl = await fetchReceiptUrl(input.paymentIntentId);
  }

  // 2. Open a log row in Firestore so we can audit later.
  let logRef: { id: string } | null = null;
  try {
    if (db) {
      const ref = await addDoc(collection(db, 'post_purchase_emails'), {
        userId: input.userId,
        userEmail: input.userEmail,
        userName: input.userName || null,
        tierName: input.tierName,
        amountCents: input.amountCents,
        amountFormatted,
        paymentIntentId: input.paymentIntentId || null,
        attemptDocId: input.attemptDocId || null,
        promoCode: input.promoCode || null,
        promoAmount: input.promoAmount || 0,
        receiptUrl: result.receiptUrl,
        ownerRecipient: PLATFORM_OWNER_EMAIL,
        status: 'sending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      logRef = ref;
      result.logDocId = ref.id;
    }
  } catch (logErr) {
    console.warn('[postPurchaseEmail] could not open log doc (non-fatal):', logErr);
  }

  // 3. Compose payloads.
  const proPayload = {
    type: 'membership-welcome',
    emailData: {
      recipientEmail: input.userEmail,
      recipientName: input.userName || '',
      tierName: input.tierName,
      amountFormatted,
      paymentIntentId: input.paymentIntentId || '',
      receiptUrl: result.receiptUrl || '',
      kickoffCalendarUrl: KICKOFF_CALENDAR_URL,
      dashboardUrl: MEMBER_DASHBOARD_URL,
      supportEmail: SUPPORT_EMAIL,
      purchasedAt: new Date().toISOString(),
      replyTo: SUPPORT_EMAIL,
    },
  };

  const ownerPayload = {
    type: 'membership-sale-internal',
    emailData: {
      recipientEmail: PLATFORM_OWNER_EMAIL,
      tierName: input.tierName,
      amountFormatted,
      paymentIntentId: input.paymentIntentId || '',
      proName: input.userName || '',
      proEmail: input.userEmail,
      proPhone: input.userPhone || '',
      promoCode: input.promoCode || '',
      promoAmountFormatted: promoAmountFormatted || '',
      attemptDocId: input.attemptDocId || '',
      stripeDashboardUrl: input.paymentIntentId
        ? `https://dashboard.stripe.com/payments/${input.paymentIntentId}`
        : '',
      adminContactsUrl:
        typeof window !== 'undefined'
          ? `${window.location.origin}/admin/crm-contacts`
          : 'https://refund-connect.com/admin/crm-contacts',
      replyTo: input.userEmail, // owner can reply directly to the new member
    },
  };

  // 4. Fire both sends in parallel — independent failure modes.
  let sendEmail: ReturnType<typeof getSendEmailCallable>;
  try {
    sendEmail = getSendEmailCallable();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not initialize email client';
    result.errors.proEmailError = msg;
    result.errors.ownerEmailError = msg;
    await safeLogUpdate(logRef, {
      status: 'failed',
      proEmailError: msg,
      ownerEmailError: msg,
    });
    return result;
  }

  const [proResp, ownerResp] = await Promise.allSettled([
    sendEmail(proPayload),
    sendEmail(ownerPayload),
  ]);

  if (proResp.status === 'fulfilled') {
    result.proEmailSent = true;
  } else {
    result.errors.proEmailError =
      proResp.reason instanceof Error
        ? proResp.reason.message
        : String(proResp.reason || 'send failed');
    console.error('[postPurchaseEmail] welcome email failed:', proResp.reason);
  }

  if (ownerResp.status === 'fulfilled') {
    result.ownerEmailSent = true;
  } else {
    result.errors.ownerEmailError =
      ownerResp.reason instanceof Error
        ? ownerResp.reason.message
        : String(ownerResp.reason || 'send failed');
    console.error('[postPurchaseEmail] owner alert failed:', ownerResp.reason);
  }

  // 5. Final log write.
  await safeLogUpdate(logRef, {
    status:
      result.proEmailSent && result.ownerEmailSent
        ? 'sent'
        : result.proEmailSent || result.ownerEmailSent
          ? 'partial'
          : 'failed',
    proEmailSent: result.proEmailSent,
    ownerEmailSent: result.ownerEmailSent,
    proEmailError: result.errors.proEmailError || null,
    ownerEmailError: result.errors.ownerEmailError || null,
    sentAt: serverTimestamp(),
  });

  return result;
}

async function safeLogUpdate(
  logRef: { id: string } | null,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!logRef || !db) return;
  try {
    // Use addDoc-style update via setDoc with merge would need a ref import;
    // use updateDoc dynamically to keep the bundle slim.
    const { updateDoc, doc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'post_purchase_emails', logRef.id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[postPurchaseEmail] log update failed (non-fatal):', e);
  }
}
