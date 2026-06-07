// ============================================================================
// subscriptionService — Phase 4 recurring membership billing
//
// Talks to the Firebase Cloud Functions `createSubscriptionCheckout` and
// `createBillingPortalSession`. The first returns a Stripe-hosted Checkout URL
// (subscription mode) we redirect to; the second returns a Stripe Customer
// Portal URL where members manage their card / invoices / cancellation.
//
// The recurring tier → membership-level mapping mirrors membershipCheckoutService
// so the one-time and subscription paths agree on tier semantics. The webhook
// (`customer.subscription.*`) is the authoritative source that flips the
// professionals/{id} doc on renewal/cancel.
// ============================================================================

import type { MembershipTier } from '@/services/membershipCheckoutService';
import { TIER_LEVEL, TIER_PRICE } from '@/services/membershipCheckoutService';

const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'refund-connect-1m30';
const FN_BASE = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;
const SUBSCRIPTION_CHECKOUT_URL = `${FN_BASE}/createSubscriptionCheckout`;
const BILLING_PORTAL_URL = `${FN_BASE}/createBillingPortalSession`;

export interface StartSubscriptionParams {
  tier: MembershipTier;
  professionalId: string;
  email?: string;
  name?: string;
  /** Where Stripe redirects on success / cancel (defaults set server-side). */
  successUrl?: string;
  cancelUrl?: string;
}

export interface StartSubscriptionResult {
  ok: boolean;
  url?: string;
  sessionId?: string;
  error?: string;
  /** Set when the operator hasn't configured a recurring Price for the tier. */
  code?: string;
}

/**
 * Create a recurring-subscription Checkout Session and return its hosted URL.
 * Caller typically redirects: `window.location.href = result.url`.
 */
export async function startSubscriptionCheckout(
  params: StartSubscriptionParams,
): Promise<StartSubscriptionResult> {
  if (!params.professionalId) {
    return { ok: false, error: 'You must be signed in to subscribe.' };
  }
  try {
    const resp = await fetch(SUBSCRIPTION_CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: params.tier,
        professionalId: params.professionalId,
        email: params.email,
        name: params.name,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok || !data?.url) {
      return {
        ok: false,
        error: data?.error || `Subscription checkout failed (HTTP ${resp.status}).`,
        code: data?.code,
      };
    }
    return { ok: true, url: data.url, sessionId: data.sessionId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not reach the subscription server.',
    };
  }
}

/** Convenience: start checkout and redirect the browser to Stripe. */
export async function redirectToSubscriptionCheckout(
  params: StartSubscriptionParams,
): Promise<StartSubscriptionResult> {
  const result = await startSubscriptionCheckout(params);
  if (result.ok && result.url && typeof window !== 'undefined') {
    window.location.href = result.url;
  }
  return result;
}

export interface BillingPortalResult {
  ok: boolean;
  url?: string;
  error?: string;
  code?: string;
}

/**
 * Open the Stripe Customer Portal for a professional (manage card / invoices /
 * cancel). Returns the portal URL; caller redirects.
 */
export async function openBillingPortal(opts: {
  professionalId: string;
  returnUrl?: string;
}): Promise<BillingPortalResult> {
  try {
    const resp = await fetch(BILLING_PORTAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        professionalId: opts.professionalId,
        returnUrl: opts.returnUrl,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok || !data?.url) {
      return {
        ok: false,
        error: data?.error || `Could not open billing portal (HTTP ${resp.status}).`,
        code: data?.code,
      };
    }
    return { ok: true, url: data.url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not reach the billing server.',
    };
  }
}

/** Recurring tiers offered for subscription (excludes free Directory Listing). */
export const SUBSCRIPTION_TIERS: {
  tier: MembershipTier;
  name: string;
  priceYearly: number;
  /** True when the tier requires a PTIN on file before subscribing. */
  requiresPtin: boolean;
}[] = [
  { tier: 'associate', name: TIER_LEVEL.associate, priceYearly: TIER_PRICE.associate, requiresPtin: true },
  { tier: 'professional', name: TIER_LEVEL.professional, priceYearly: TIER_PRICE.professional, requiresPtin: true },
  { tier: 'premier', name: TIER_LEVEL.premier, priceYearly: TIER_PRICE.premier, requiresPtin: true },
  { tier: 'service_bureau', name: TIER_LEVEL.service_bureau, priceYearly: TIER_PRICE.service_bureau, requiresPtin: true },
];
