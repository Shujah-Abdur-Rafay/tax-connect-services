// =============================================================================
// stripeConnectService — Stripe Connect Express helpers for pros
// =============================================================================
// All Stripe API calls go through the `stripeConnect` Firebase Cloud Function
// (functions/src/index.ts). We also mirror the connected account id + the
// three onboarding capability booleans onto the pro's Firestore document so
// the rest of the app (checkout flow, admin dashboard) can read them without
// hitting Stripe directly.
//
// Cloud Function endpoint:
//   https://us-central1-<projectId>.cloudfunctions.net/stripeConnect
// Deploy with:
//   firebase deploy --only functions:stripeConnect
// =============================================================================


import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Firebase Functions endpoint ──────────────────────────────────────────────
// The `stripeConnect` HTTPS Cloud Function lives in functions/src/index.ts and
// is deployed to: https://us-central1-<project>.cloudfunctions.net/stripeConnect
//
// Override at build time with VITE_FIREBASE_PROJECT_ID if your Firebase project
// id differs from the default below.
const FIREBASE_PROJECT_ID =
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ||
  'refund-connect-1m30';

const STRIPE_CONNECT_URL =
  (import.meta as any).env?.VITE_STRIPE_CONNECT_URL ||
  `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/stripeConnect`;

/**
 * Thin POST wrapper around the stripeConnect Cloud Function. Normalises both
 * transport failures and `{ success: false, error }` payload errors into a
 * single thrown Error so the dashboard UI can render a friendly message.
 */
async function invokeConnect<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(STRIPE_CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    throw new Error(
      e?.message ||
        'Could not reach the Stripe Connect service. Check your internet connection.'
    );
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore parse errors */
  }

  if (!res.ok || (json && json.success === false)) {
    const msg =
      json?.error ||
      `Stripe Connect request failed (HTTP ${res.status}). ` +
        (res.status === 404
          ? "Cloud Function isn't deployed yet — run: firebase deploy --only functions:stripeConnect"
          : '');
    throw new Error(msg);
  }
  return json as T;
}

// ── Public types (consumed by ProPayouts.tsx) ───────────────────────────────
/** Onboarding / capability flags mirrored onto the pro's Firestore doc. */
export interface StripeConnectAccountSummary {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string | null;
  defaultCurrency: string;
  email: string | null;
  businessProfile: { name?: string; url?: string } | null;
  requirements: {
    currentlyDue: string[];
    pastDue: string[];
    eventuallyDue: string[];
    disabledReason: string | null;
  };
  payoutSchedule: {
    delay_days?: number;
    interval?: string;
    weekly_anchor?: string;
    monthly_anchor?: number;
  } | null;
}

export interface StripeConnectBalance {
  currency: string;
  availableCents: number;
  pendingCents: number;
  reservedCents: number;
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

export interface StripeConnectPayout {
  id: string;
  amount: number; // cents
  currency: string;
  arrivalDate: number; // unix seconds
  status: 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';
  method: 'standard' | 'instant' | string;
  type: 'bank_account' | 'card' | string;
  created: number;
  description: string | null;
  statementDescriptor: string | null;
  failureMessage: string | null;
}

export interface StripeConnectDashboard {
  account: StripeConnectAccountSummary;
  balance: StripeConnectBalance;
  payouts: StripeConnectPayout[];
  /** Single-use Stripe Express dashboard URL (~5min TTL), or null if not yet eligible. */
  expressLoginUrl: string | null;
}



/**
 * Start (or resume) Express onboarding for a pro. Returns a hosted Stripe
 * URL — open it in the same tab; Stripe will redirect back to `returnUrl`
 * when the pro finishes (or `refreshUrl` if the link expires mid-flow).
 *
 * Side-effect: writes `stripe_account_id` to professionals/{proId} as soon
 * as Stripe assigns it, so a refresh / abandoned flow still resumes the
 * same account next time.
 */
export async function startConnectOnboarding(opts: {
  proId: string;
  email?: string;
  name?: string;
  country?: string;
  existingAccountId?: string | null;
  /** Where Stripe sends the pro if the Account Link expires. */
  refreshUrl?: string;
  /** Where Stripe sends the pro on success. */
  returnUrl?: string;
}): Promise<{ accountId: string; onboardingUrl: string }> {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://refundconnect.com';
  const refreshUrl = opts.refreshUrl || `${origin}/pro-payouts?refresh=1`;
  const returnUrl = opts.returnUrl || `${origin}/pro-payouts?onboarded=1`;

  const resp = await invokeConnect<{
    accountId: string;
    onboardingUrl: string;
    expiresAt: number;
  }>({
    action: 'onboard',
    proId: opts.proId,
    email: opts.email,
    name: opts.name,
    country: opts.country || 'US',
    existingAccountId: opts.existingAccountId || undefined,
    refreshUrl,
    returnUrl,
  });

  // Persist the account id immediately — even before onboarding completes —
  // so subsequent resume attempts reuse the same account and we never
  // create duplicate Stripe accounts for the same pro.
  if (db && opts.proId && resp.accountId) {
    try {
      await updateDoc(doc(db, 'professionals', opts.proId), {
        stripe_account_id: resp.accountId,
        stripe_onboarding_started_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[stripeConnectService] failed to persist accountId', e);
    }
  }

  return resp;
}

/**
 * Fetch live account status from Stripe and sync the three capability
 * booleans (`stripe_charges_enabled`, `stripe_payouts_enabled`,
 * `stripe_details_submitted`) onto the pro's Firestore doc.
 *
 * Called from the /pro-payouts page on mount + after the user returns
 * from Stripe-hosted onboarding (?onboarded=1).
 */
export async function syncConnectAccountStatus(
  proId: string,
  accountId: string
): Promise<StripeConnectAccountSummary> {
  const summary = await invokeConnect<StripeConnectAccountSummary>({
    action: 'status',
    accountId,
    proId, // lets the Cloud Function sync capability flags server-side too
  });


  if (db && proId) {
    try {
      await updateDoc(doc(db, 'professionals', proId), {
        stripe_account_id: summary.accountId,
        stripe_charges_enabled: summary.chargesEnabled,
        stripe_payouts_enabled: summary.payoutsEnabled,
        stripe_details_submitted: summary.detailsSubmitted,
        stripe_onboarding_completed_at:
          summary.chargesEnabled && summary.payoutsEnabled
            ? serverTimestamp()
            : null,
        updated_at: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[stripeConnectService] failed to sync capability flags', e);
    }
  }

  return summary;
}

/**
 * Fetch everything the /pro-payouts page needs in a single round trip:
 * account summary, current balance breakdown, recent payouts, and a
 * single-use Stripe Express dashboard URL.
 */
export async function fetchConnectDashboard(
  accountId: string
): Promise<StripeConnectDashboard> {
  return invokeConnect<StripeConnectDashboard>({
    action: 'dashboard',
    accountId,
  });
}

/**
 * Read the Stripe-related fields directly from the pro's Firestore doc.
 * Useful for places that don't want to hit Stripe (e.g. the checkout flow
 * just needs the account id to enable destination charges).
 */
export async function getProStripeAccount(proId: string): Promise<{
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
}> {
  if (!db || !proId) {
    return {
      stripe_account_id: null,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_details_submitted: false,
    };
  }
  try {
    const snap = await getDoc(doc(db, 'professionals', proId));
    if (!snap.exists()) {
      return {
        stripe_account_id: null,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_details_submitted: false,
      };
    }
    const data = snap.data() as any;
    return {
      stripe_account_id: data.stripe_account_id || null,
      stripe_charges_enabled: !!data.stripe_charges_enabled,
      stripe_payouts_enabled: !!data.stripe_payouts_enabled,
      stripe_details_submitted: !!data.stripe_details_submitted,
    };
  } catch (e) {
    console.warn('[stripeConnectService] getProStripeAccount failed', e);
    return {
      stripe_account_id: null,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_details_submitted: false,
    };
  }
}

/** Format cents → "$1,234.56" for a given currency (defaults to USD). */
export function formatStripeAmount(cents: number, currency = 'usd'): string {
  const value = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

/** Format a unix-second timestamp from Stripe as a human date. */
export function formatStripeDate(unixSeconds: number): string {
  if (!unixSeconds) return '—';
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
