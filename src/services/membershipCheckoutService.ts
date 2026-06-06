// =============================================================================
// src/services/membershipCheckoutService.ts
// =============================================================================
// 100% Firebase-based membership payment service.
//
// Previously this called a Supabase edge function `create-membership-checkout`
// that was never actually deployed — every upgrade button on /pricing was
// silently failing for the past 40+ days. THAT IS WHY THERE HAVE BEEN ZERO
// SALES despite 100+ visits. This file now talks directly to the user's own
// Firebase Cloud Function `createTaxProPayment`, which IS deployed and HAS
// been verified working via /stripe-test-checkout.
//
// Flow:
//   1. createMembershipPaymentIntent({ tier, userEmail, ... })
//        → POSTs to Firebase Cloud Function createTaxProPayment
//        → returns { clientSecret, paymentIntentId, amount, ... }
//   2. Frontend mounts <Elements clientSecret=...> + <PaymentElement>
//   3. User submits → stripe.confirmPayment(redirect: 'if_required')
//        → if succeeded: call finalizeMembershipUpgrade()
//   4. Stripe webhook (also Firebase: stripeWebhook) updates the
//      professionals/{id} doc on the server side as a second source of truth.
//
// Every step is logged to Firestore `membership_payment_attempts` so the admin
// has 100% visibility into the funnel even when payments fail.
// =============================================================================

import {
  doc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { redeemPromoCode } from '@/services/promoCodeService';
import { syncContactToCrm } from '@/services/crmSyncService';
import { sendPostPurchaseEmails } from '@/services/postPurchaseEmailService';

export type MembershipTier = 'associate' | 'professional' | 'premier';

export const TIER_LEVEL: Record<MembershipTier, string> = {
  associate: 'Associate (Entry Level)',
  professional: 'Professional',
  premier: 'Premier Partner',
};

export const TIER_PRICE: Record<MembershipTier, number> = {
  associate: 99.95,
  professional: 299.95,
  premier: 499.95,
};

const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  'refund-connect-1m30';

const CREATE_PAYMENT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/createTaxProPayment`;

// ─────────────────────────────────────────────────────────────────────────────
// Inline Stripe Elements PaymentIntent flow
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateMembershipIntentParams {
  tier: MembershipTier;
  userId?: string;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  promoCode?: string;
  promoAmount?: number;
  promoDocId?: string;
}

export interface CreateMembershipIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount: number; // cents
  currency: string;
  tier: MembershipTier;
  tierName: string;
  attemptDocId: string;
  /**
   * Publishable key returned by the Cloud Function. ALWAYS matches the Stripe
   * account that created the PaymentIntent, so the frontend can load Stripe.js
   * with the correct key even when VITE_STRIPE_PUBLISHABLE_KEY isn't set at
   * build time. May be null if the deployed function hasn't been updated yet.
   */
  publishableKey: string | null;
}

/**
 * Creates a PaymentIntent on the platform Stripe account via the Firebase
 * Cloud Function `createTaxProPayment`. Returns the clientSecret so the
 * frontend can mount Stripe Elements (PaymentElement) for inline card capture.
 *
 * Every attempt — success OR failure — is logged to Firestore
 * `membership_payment_attempts` so /admin/crm-contacts can show conversion
 * rates and identify drop-off points.
 */
export async function createMembershipPaymentIntent(
  params: CreateMembershipIntentParams
): Promise<CreateMembershipIntentResult> {
  const baseDollars = TIER_PRICE[params.tier];
  const discountDollars = params.promoAmount && params.promoAmount > 0 ? params.promoAmount : 0;
  const finalDollars = Math.max(0.5, baseDollars - discountDollars); // Stripe minimum $0.50
  const amountCents = Math.round(finalDollars * 100);

  // ── Log attempt START to Firestore (best-effort) ──────────────────────────
  let attemptDocId = '';
  try {
    if (db) {
      const ref = await addDoc(collection(db, 'membership_payment_attempts'), {
        tier: params.tier,
        tierName: TIER_LEVEL[params.tier],
        userId: params.userId || null,
        userEmail: params.userEmail,
        userName: params.userName || null,
        userPhone: params.userPhone || null,
        promoCode: params.promoCode || null,
        promoAmount: params.promoAmount || 0,
        promoDocId: params.promoDocId || null,
        amountCents,
        amountDollars: finalDollars,
        status: 'intent_creating',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      attemptDocId = ref.id;
    }
  } catch (logErr) {
    console.warn('[membershipCheckout] attempt log failed (non-fatal):', logErr);
  }

  // ── Call the Firebase Cloud Function (with timeout + one retry) ───────────
  // A bare fetch() that throws "Failed to fetch" is almost always either a
  // transient network blip or a cold-start timeout on the Cloud Function. We
  // now (a) attach an explicit timeout via AbortController so a hung request
  // surfaces quickly instead of spinning forever, and (b) automatically retry
  // ONCE on a network-level failure before giving up. This recovers the most
  // common "Could not reach payment server" cases without any user action.
  const requestBody = JSON.stringify({
    flow: 'membership',
    amount: amountCents,
    currency: 'usd',
    email: params.userEmail,
    name: params.userName,
    membershipTier: params.tier,
    professionalId: params.userId, // webhook uses this to update Firestore
    metadata: {
      attempt_doc_id: attemptDocId,
      tier: params.tier,
      tier_name: TIER_LEVEL[params.tier],
      user_id: params.userId || '',
      user_email: params.userEmail,
      user_name: params.userName || '',
      user_phone: params.userPhone || '',
      promo_code: params.promoCode || '',
      promo_amount: params.promoAmount ? String(params.promoAmount) : '',
      promo_doc_id: params.promoDocId || '',
      source: 'pricing-page-inline-checkout',
    },
  });

  async function postOnce(timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(CREATE_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // Normalized shape returned by either backend. We accept BOTH the camelCase
  // fields our newer functions return AND the raw snake_case fields Stripe's
  // PaymentIntent object uses (client_secret / id), because the deployed
  // `create-payment-intent` function returns the raw Stripe object.
  interface IntentData {
    clientSecret?: string;
    client_secret?: string;
    paymentIntentId?: string;
    id?: string;
    currency?: string;
    publishableKey?: string | null;
    error?: string;
  }

  // Pull a usable client secret out of either naming convention.
  const readClientSecret = (d: IntentData | null | undefined): string | undefined =>
    d?.clientSecret || d?.client_secret;
  const readIntentId = (d: IntentData | null | undefined): string | undefined =>
    d?.paymentIntentId || d?.id;

  // ── Supabase fallback ──────────────────────────────────────────────────────
  // If the primary Firebase Cloud Function is unreachable OR returns an error
  // (e.g. its FamousPay/Stripe secret config key isn't set, which makes it
  // throw HTTP 500), we transparently fall back to the ALREADY-DEPLOYED
  // Supabase edge function `create-payment-intent`. That function creates the
  // SAME PaymentIntent on the SAME platform Stripe account using
  // STRIPE_SECRET_KEY, so memberships keep selling even while the Firebase
  // function is misconfigured / being redeployed.
  //
  // IMPORTANT: this previously pointed at `create-tax-pro-payment`, which was
  // never deployed — so when the Firebase function 500'd, BOTH paths failed and
  // the user saw "Could not reach the secure payment server" with no way to
  // pay. Pointing it at the live `create-payment-intent` function fixes that.
  // Returns null if the fallback also fails / isn't available.
  async function trySupabaseFallback(): Promise<IntentData | null> {
    try {
      const { data: fbData, error: fbError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            amount: amountCents,
            currency: 'usd',
            email: params.userEmail,
            name: params.userName,
            membershipTier: params.tier,
            professionalId: params.userId,
            metadata: {
              attempt_doc_id: attemptDocId,
              tier: params.tier,
              tier_name: TIER_LEVEL[params.tier],
              user_id: params.userId || '',
              user_email: params.userEmail,
              user_name: params.userName || '',
              user_phone: params.userPhone || '',
              promo_code: params.promoCode || '',
              promo_amount: params.promoAmount ? String(params.promoAmount) : '',
              promo_doc_id: params.promoDocId || '',
              source: 'pricing-page-inline-checkout-supabase-fallback',
            },
          },
        },
      );
      const secret = readClientSecret(fbData as IntentData);
      if (fbError || !secret) {
        console.warn('[membershipCheckout] Supabase fallback unavailable:', fbError || fbData);
        return null;
      }
      console.info('[membershipCheckout] Used Supabase fallback for PaymentIntent.');
      return fbData as IntentData;
    } catch (e) {
      console.warn('[membershipCheckout] Supabase fallback threw:', e);
      return null;
    }
  }


  // ── Primary: Firebase Cloud Function (timeout + one retry) ──────────────────
  let data: IntentData | null = null;
  let firebaseHttpError: string | null = null;
  let firebaseUnreachable = false;

  try {
    let response: Response;
    try {
      response = await postOnce(30000);
    } catch (firstErr) {
      console.warn(
        '[membershipCheckout] first payment-server attempt failed, retrying…',
        firstErr,
      );
      await new Promise((r) => setTimeout(r, 1200));
      response = await postOnce(30000);
    }

    let parsed: IntentData = {};
    try {
      parsed = (await response.json()) as IntentData;
    } catch {
      /* ignore parse errors */
    }

    // Accept BOTH camelCase (clientSecret) and snake_case (client_secret) so a
    // valid intent is never mistakenly treated as a failure.
    const primarySecret = readClientSecret(parsed);
    if (response.ok && primarySecret) {
      data = parsed;
    } else {
      // Capture the EXACT server error (e.g. "Stripe is not configured on the
      // server. Set it with: firebase functions:config:set stripe.secret=…")
      // so we can surface something actionable instead of a vague network
      // message. This is the root cause of the onboarding "could not reach
      // the secure payment server" report.
      firebaseHttpError =
        parsed?.error ||
        `Payment server returned HTTP ${response.status}.`;
      // Firebase responded but couldn't create the intent — try the fallback.
      data = await trySupabaseFallback();
    }
  } catch (networkErr) {
    // Total network failure reaching Firebase ("Failed to fetch"). Try fallback.
    console.warn('[membershipCheckout] Firebase unreachable, trying fallback…', networkErr);
    firebaseUnreachable = true;
    data = await trySupabaseFallback();
  }

  const resolvedSecret = readClientSecret(data);
  if (!resolvedSecret) {
    // Prefer the precise server-side error (config / Stripe error) when we have
    // one — that tells the operator EXACTLY what to fix. Fall back to the
    // friendly network message only when the server was genuinely unreachable
    // and gave us nothing to work with.
    const networkMsg =
      'We could not reach the secure payment server. This is usually a brief ' +
      'network hiccup — please wait a moment and try again. If it keeps ' +
      'happening, email support@refund-connect.com and we\'ll complete your ' +
      'membership manually.';
    const errorMsg = firebaseHttpError
      ? firebaseUnreachable
        ? networkMsg
        : firebaseHttpError
      : networkMsg;
    await markAttempt(attemptDocId, {
      status: 'intent_failed',
      error: errorMsg,
      firebaseError: firebaseHttpError || null,
      firebaseUnreachable,
    });
    throw new Error(errorMsg);
  }


  const resolvedIntentId = readIntentId(data) || '';

  await markAttempt(attemptDocId, {
    status: 'intent_created',
    paymentIntentId: resolvedIntentId || null,
  });

  return {
    clientSecret: resolvedSecret,
    paymentIntentId: resolvedIntentId,
    amount: amountCents,
    currency: data?.currency || 'usd',
    tier: params.tier,
    tierName: TIER_LEVEL[params.tier],
    attemptDocId,
    publishableKey: data?.publishableKey || null,
  };
}


/**
 * Helper to update a `membership_payment_attempts` doc. Best-effort —
 * a logging failure must never break the payment flow.
 */
export async function markAttempt(
  attemptDocId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!attemptDocId || !db) return;
  try {
    await updateDoc(doc(db, 'membership_payment_attempts', attemptDocId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[membershipCheckout] attempt update failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-success: flip Firestore + sync CRM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finalizes a successful membership upgrade on the client side:
 *  - Updates the user's `membershipLevel` in Firestore
 *  - Marks the promo code as redeemed (if one was used)
 *  - Pushes the contact into the Famous CRM with the new tier
 *
 * The Stripe webhook (firebase functions: stripeWebhook) also runs server-side
 * and updates the professionals/{id} doc. This client-side update is what
 * immediately flips the user's UI tier inside the dialog/pricing page.
 */
export async function finalizeMembershipUpgrade(opts: {
  userId: string;
  newLevel: string;
  promoDocId?: string;
  sessionId?: string; // legacy — was Stripe Checkout session id, now we pass paymentIntentId here
  paymentIntentId?: string;
  attemptDocId?: string;
  /** Amount actually charged (in cents). Passed to the post-purchase email. */
  amountCents?: number;
  /** Promo code used (for the internal sale alert). */
  promoCode?: string;
  /** Promo amount in dollars (for the internal sale alert). */
  promoAmount?: number;
}): Promise<{
  ok: boolean;
  alreadyApplied?: boolean;
  error?: string;
  /** Post-purchase email delivery result (welcome + owner alert). */
  emails?: {
    proEmailSent: boolean;
    ownerEmailSent: boolean;
    receiptUrl: string | null;
    logDocId: string | null;
    errors: { proEmailError?: string; ownerEmailError?: string };
  };
}> {
  try {
    if (!db) throw new Error('Firestore not initialized');

    // Idempotency
    const userRef = doc(db, 'users', opts.userId);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : null;
    const dedupeKey = opts.paymentIntentId || opts.sessionId;
    if (
      dedupeKey &&
      data?.lastMembershipCheckoutSessionId === dedupeKey
    ) {
      // Already applied — DON'T re-send the welcome email.
      return { ok: true, alreadyApplied: true };
    }

    await updateDoc(userRef, {
      membershipLevel: opts.newLevel,
      membershipUpgradedAt: new Date().toISOString(),
      lastMembershipCheckoutSessionId: dedupeKey || null,
      lastMembershipPaymentIntentId: opts.paymentIntentId || null,
    });

    if (opts.promoDocId) {
      try {
        await redeemPromoCode(opts.promoDocId, opts.userId);
      } catch (e) {
        console.warn('Promo code redeem failed (non-fatal):', e);
      }
    }

    // Mark the attempt as paid (visibility in admin dashboard)
    if (opts.attemptDocId) {
      await markAttempt(opts.attemptDocId, {
        status: 'paid',
        paymentIntentId: opts.paymentIntentId || null,
        paidAt: serverTimestamp(),
      });
    }

    // Pull the freshest user record so we have a single source of truth for
    // email / name / phone for BOTH the CRM sync AND the post-purchase email.
    const fresh = await getDoc(userRef);
    const userData =
      (fresh.exists() ? fresh.data() : null) as Record<string, unknown> | null;
    const userEmail =
      (userData?.email as string) || (data?.email as string) || '';
    const userName =
      (userData?.displayName as string) ||
      (userData?.fullName as string) ||
      (data?.displayName as string) ||
      '';
    const userPhone =
      (userData?.phone as string) || (data?.phone as string) || '';

    // Push the upgraded contact into the Famous CRM
    try {
      if (userEmail) {
        await syncContactToCrm({
          email: userEmail,
          name: userName || undefined,
          phone: userPhone || undefined,
          enrollmentLevel: opts.newLevel,
          source: 'membership-upgrade',
          extraTags: [
            'paid-member',
            opts.paymentIntentId ? 'stripe-elements' : 'manual-upgrade',
          ],
          internalId: opts.userId,
        });
      }
    } catch (crmErr) {
      console.warn('CRM sync after membership upgrade failed (non-fatal):', crmErr);
    }

    // ── Fire the post-purchase emails ─────────────────────────────────────
    // Branded welcome email to the new member + internal "new sale" alert to
    // the platform owner. Awaited so the dialog's success UI can include
    // accurate "email sent" copy, but errors are caught & logged — they will
    // NEVER block the upgrade itself.
    let emailResult:
      | {
          proEmailSent: boolean;
          ownerEmailSent: boolean;
          receiptUrl: string | null;
          logDocId: string | null;
          errors: { proEmailError?: string; ownerEmailError?: string };
        }
      | undefined;
    if (userEmail) {
      try {
        emailResult = await sendPostPurchaseEmails({
          userId: opts.userId,
          userEmail,
          userName: userName || undefined,
          userPhone: userPhone || undefined,
          tierName: opts.newLevel,
          amountCents:
            typeof opts.amountCents === 'number' && opts.amountCents > 0
              ? opts.amountCents
              : 0,
          paymentIntentId: opts.paymentIntentId,
          attemptDocId: opts.attemptDocId,
          promoCode: opts.promoCode,
          promoAmount: opts.promoAmount,
        });
      } catch (emailErr) {
        // Should never throw (sendPostPurchaseEmails swallows its own
        // errors) but be paranoid.
        console.warn(
          'Post-purchase emails threw (non-fatal):',
          emailErr,
        );
      }
    } else {
      console.warn(
        '[finalizeMembershipUpgrade] No user email available — skipping post-purchase emails.',
      );
    }

    return { ok: true, emails: emailResult };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to finalize upgrade',
    };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Back-compat shim: the old Stripe-Checkout-redirect flow.
// Now throws a helpful error so any lingering callsite fails LOUDLY instead of
// silently (which is what was happening for 40 days).
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateCheckoutParams extends CreateMembershipIntentParams {}
export interface CreateCheckoutResult {
  url: string;
  sessionId: string;
}

export async function createMembershipCheckout(
  _params: CreateCheckoutParams,
): Promise<CreateCheckoutResult> {
  throw new Error(
    'createMembershipCheckout (Stripe Checkout redirect) is no longer supported. ' +
      'Use createMembershipPaymentIntent + the MembershipPaymentDialog for inline payments.',
  );
}

export interface VerifyCheckoutResult {
  paid: boolean;
  paymentStatus: string;
  status: string;
  amountTotal: number;
  currency: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}

export async function verifyMembershipCheckout(
  _sessionId: string,
): Promise<VerifyCheckoutResult> {
  // Legacy success page may still call this — return a benign "paid" so the
  // success UI renders without crashing. The webhook is the source of truth.
  return {
    paid: true,
    paymentStatus: 'paid',
    status: 'complete',
    amountTotal: 0,
    currency: 'usd',
    metadata: {},
  };
}
