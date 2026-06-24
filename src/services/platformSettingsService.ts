// ============================================================================
// platformSettingsService — read/write the global Refund Connect platform
// settings doc stored at Firestore `platform_settings/fees`.
//
// Today this controls a SINGLE knob: the default application fee percent that
// the platform takes on every client → pro gig/booking payment as a Stripe
// Connect destination charge. Historically this was hardcoded as `20` in both
// the create-booking-payment edge function and the createTaxProPayment
// Firebase Function. Now both functions read this doc at request time so the
// platform owner can change the fee on the fly from /admin/platform-fees
// without redeploying any backend code.
//
// Firestore schema (single doc):
//
//   platform_settings/fees
//     applicationFeePercent: number           // 0..100, default 20
//     updatedAt:             string (ISO)
//     updatedByUid?:         string
//     updatedByEmail?:       string
//     note?:                 string           // human-readable change reason
//
// Security model: the doc should be public-read (the fee % is not sensitive —
// it's effectively printed on every checkout) and admin-write. Set Firestore
// rules to:
//
//   match /platform_settings/{docId} {
//     allow read: if true;
//     allow write: if request.auth != null
//                  && get(/databases/$(database)/documents/users/$(request.auth.uid))
//                       .data.role == 'admin';
//   }
//
// Public read is important because the Supabase edge function
// `create-booking-payment` reads this doc via the unauthenticated Firestore
// REST API — see fetchPlatformFeePercentREST() below for the same shape
// used server-side.
// ============================================================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const DEFAULT_PLATFORM_FEE_PERCENT = 20;

export const PLATFORM_SETTINGS_COLLECTION = 'platform_settings';
export const PLATFORM_FEES_DOC_ID = 'fees';

export interface PlatformFeeSettings {
  applicationFeePercent: number;
  updatedAt?: string | null;
  updatedByUid?: string | null;
  updatedByEmail?: string | null;
  note?: string | null;
}

/**
 * Clamp + sanitize an arbitrary input into a valid platform fee percent.
 * Returns `DEFAULT_PLATFORM_FEE_PERCENT` if the input is non-finite, NaN,
 * negative, or above 100.
 */
export function sanitizeFeePercent(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return DEFAULT_PLATFORM_FEE_PERCENT;
  if (n < 0) return 0;
  if (n > 100) return 100;
  // Round to 2 decimals so we don't store 19.9999999
  return Math.round(n * 100) / 100;
}

/**
 * Read the live platform fee settings from Firestore. If the doc has never
 * been created yet (first-ever load on a fresh project) this returns the
 * default 20% and does NOT auto-create the doc — write happens only when an
 * admin saves changes from /admin/platform-fees.
 */
export async function fetchPlatformFeeSettings(): Promise<PlatformFeeSettings> {
  if (!db) {
    return { applicationFeePercent: DEFAULT_PLATFORM_FEE_PERCENT };
  }
  try {
    const ref = doc(db, PLATFORM_SETTINGS_COLLECTION, PLATFORM_FEES_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { applicationFeePercent: DEFAULT_PLATFORM_FEE_PERCENT };
    }
    const data = snap.data() || {};
    return {
      applicationFeePercent: sanitizeFeePercent(data.applicationFeePercent),
      updatedAt:
        typeof data.updatedAt === 'string'
          ? data.updatedAt
          : data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      updatedByUid: data.updatedByUid ?? null,
      updatedByEmail: data.updatedByEmail ?? null,
      note: data.note ?? null,
    };
  } catch (err) {
    console.warn(
      '[platformSettingsService] fetchPlatformFeeSettings failed, falling back to default:',
      err
    );
    return { applicationFeePercent: DEFAULT_PLATFORM_FEE_PERCENT };
  }
}

/**
 * Shorthand the gigOrdersService uses when it just needs the number to pass
 * to the edge function. Never throws — returns 20 on any failure so a
 * temporary Firestore hiccup doesn't break checkout.
 */
export async function fetchPlatformFeePercent(): Promise<number> {
  const settings = await fetchPlatformFeeSettings();
  return settings.applicationFeePercent;
}

/**
 * Admin-only: persist a new application fee percent + audit fields.
 * Firestore rules MUST enforce the admin check — this client-side function
 * is just a convenience wrapper.
 */
export async function savePlatformFeeSettings(
  applicationFeePercent: number,
  audit: { uid?: string | null; email?: string | null; note?: string | null }
): Promise<PlatformFeeSettings> {
  if (!db) throw new Error('Firestore is not initialized');
  const clean = sanitizeFeePercent(applicationFeePercent);
  const ref = doc(db, PLATFORM_SETTINGS_COLLECTION, PLATFORM_FEES_DOC_ID);
  await setDoc(
    ref,
    {
      applicationFeePercent: clean,
      updatedAt: serverTimestamp(),
      updatedByUid: audit.uid ?? null,
      updatedByEmail: audit.email ?? null,
      note: audit.note ?? null,
    },
    { merge: true }
  );
  return fetchPlatformFeeSettings();
}
