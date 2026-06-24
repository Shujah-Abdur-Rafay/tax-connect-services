// ============================================================================
// ptinService — Phase 4 PTIN capture & gating
//
// A PTIN (Preparer Tax Identification Number) is an IRS-issued id every paid
// preparer must hold. We capture it on the professional's own
// professionals/{uid} doc (which Firestore rules already let them write) and
// gate paid membership tiers on having a validly-formatted PTIN on file.
//
// "Verified" here means format-validated (P + 8 digits). True IRS directory
// verification is a future integration; the field shape (`ptin_verified`) is
// already in place so that upgrade is a server-side flip, not a schema change.
// ============================================================================

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** IRS PTIN format: the letter P followed by 8 digits, e.g. P12345678. */
const PTIN_REGEX = /^P\d{8}$/i;

export const isValidPtin = (ptin: string | undefined | null): boolean =>
  !!ptin && PTIN_REGEX.test(ptin.trim());

/** Normalize for storage: trim + uppercase the leading P. */
export const normalizePtin = (ptin: string): string => ptin.trim().toUpperCase();

export interface PtinStatus {
  ptin: string | null;
  ptinVerified: boolean;
  /** True when a validly-formatted PTIN is on file. */
  hasPtin: boolean;
  submittedAt?: string | null;
}

/** Read the PTIN status off the professional's doc. */
export const getPtinStatus = async (uid: string): Promise<PtinStatus> => {
  const empty: PtinStatus = { ptin: null, ptinVerified: false, hasPtin: false, submittedAt: null };
  if (!db || !uid) return empty;
  try {
    const snap = await getDoc(doc(db, 'professionals', uid));
    if (!snap.exists()) return empty;
    const data = snap.data() as Record<string, unknown>;
    const ptin = (data.ptin as string) || null;
    return {
      ptin,
      ptinVerified: data.ptin_verified === true,
      hasPtin: isValidPtin(ptin),
      submittedAt: (data.ptin_submitted_at as any)?.toDate
        ? (data.ptin_submitted_at as any).toDate().toISOString()
        : (data.ptin_submitted_at as string) || null,
    };
  } catch (e) {
    console.warn('[ptinService] getPtinStatus failed:', (e as Error).message);
    return empty;
  }
};

/**
 * Persist a PTIN onto the pro's own professional doc. Throws on bad format so
 * the caller can surface a clear validation error. Sets `ptin_verified: true`
 * once the format passes (see note above re: real IRS verification).
 */
export const savePtin = async (uid: string, ptinRaw: string): Promise<string> => {
  if (!db) throw new Error('Firestore is not initialized');
  if (!uid) throw new Error('You must be signed in.');
  const ptin = normalizePtin(ptinRaw);
  if (!isValidPtin(ptin)) {
    throw new Error('Enter a valid PTIN — the letter P followed by 8 digits (e.g. P12345678).');
  }
  await updateDoc(doc(db, 'professionals', uid), {
    ptin,
    ptin_verified: true,
    ptin_submitted_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ptin;
};
