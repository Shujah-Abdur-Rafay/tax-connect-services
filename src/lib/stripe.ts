// =============================================================================
// src/lib/stripe.ts — Stripe.js initializer for the frontend
// =============================================================================
//
// This file loads Stripe.js exactly once and exports a shared `stripePromise`
// that every payment surface (BookingPaymentForm, PaymentForm, MembershipCard,
// etc.) re-uses. Server-side charges happen in the Supabase edge functions
// (create-payment-intent, create-subscription, create-booking-payment) which
// already read STRIPE_SECRET_KEY from the project's secrets.
//
// -----------------------------------------------------------------------------
// SETUP (3 STEPS)
// -----------------------------------------------------------------------------
// 1. Copy your Stripe PUBLISHABLE key from the Stripe Dashboard
//    (Developers → API keys). It starts with `pk_live_` or `pk_test_`.
//
// 2. Add it to your local `.env` file (and to your hosting provider's env vars
//    for production):
//      VITE_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXXXXXXXXXX
//
// 3. The SECRET key (`sk_live_…` / `sk_test_…`) is already wired up server-side
//    as the `STRIPE_SECRET_KEY` Supabase secret. Do NOT put it here — secret
//    keys must never ship in the browser bundle.
// -----------------------------------------------------------------------------

import { loadStripe, type Stripe } from '@stripe/stripe-js';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;

// A key is "valid-looking" if it's present and starts with pk_live_ or pk_test_.
// Anything else (empty, placeholder like "pk_live_XXXXXXXX", typo) counts as
// unconfigured so we can render a friendly notice instead of crashing inside
// stripe.js with a cryptic error.
function looksLikeStripeKey(key: string | undefined): key is string {
  if (!key) return false;
  if (key.includes('XXXX')) return false;
  return /^pk_(live|test)_[A-Za-z0-9]+/.test(key);
}

export const STRIPE_IS_CONFIGURED = looksLikeStripeKey(PUBLISHABLE_KEY);

if (!STRIPE_IS_CONFIGURED && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    '[stripe] VITE_STRIPE_PUBLISHABLE_KEY is missing or looks like a placeholder. ' +
      'Add your pk_live_… / pk_test_… key to .env and rebuild. ' +
      'Payment UIs will render a "not configured" message until this is set.',
  );
}

// Shared singleton. Stripe.js is downloaded once per page load.
// Returns null (instead of throwing) when the key is unconfigured, so callers
// can detect that and render a graceful fallback.
export const stripePromise: Promise<Stripe | null> = STRIPE_IS_CONFIGURED
  ? loadStripe(PUBLISHABLE_KEY!)
  : Promise.resolve(null);

export default stripePromise;
