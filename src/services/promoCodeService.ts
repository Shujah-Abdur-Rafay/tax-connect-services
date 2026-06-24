import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';

const COLLECTION = 'promo_codes';

export interface PromoCodeRecord {
  id?: string;
  email: string;
  code: string;
  amount: number;
  expiresAt: Timestamp | Date;
  redeemed: boolean;
  redeemedAt?: Timestamp | Date | null;
  redeemedBy?: string | null;
  source?: string;
  createdAt?: Timestamp | Date;
}

export interface ValidatePromoResult {
  valid: boolean;
  code?: string;
  amount?: number;
  expiresAt?: Date;
  reason?:
    | 'NOT_FOUND'
    | 'EXPIRED'
    | 'ALREADY_REDEEMED'
    | 'INVALID_FORMAT'
    | 'ERROR';
  docId?: string;
  message?: string;
}

/**
 * Creates a promo code document in Firestore. Called after the
 * edge function `send-exit-intent-promo` returns a generated code.
 */
export async function createPromoCodeRecord(opts: {
  email: string;
  code: string;
  amount: number;
  expiresAtIso: string;
  source?: string;
  variant?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const expiresAtDate = new Date(opts.expiresAtIso);
    const ref = await addDoc(collection(db, COLLECTION), {
      email: opts.email.toLowerCase().trim(),
      code: opts.code.toUpperCase().trim(),
      amount: opts.amount,
      expiresAt: Timestamp.fromDate(expiresAtDate),
      redeemed: false,
      redeemedAt: null,
      redeemedBy: null,
      source: opts.source || 'exit-intent-popup',
      variant: opts.variant || null,
      createdAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to store promo code',
    };
  }
}

/**
 * Validates a promo code:
 *  - Code must exist in Firestore
 *  - Must not be redeemed
 *  - Must not be expired
 */
export async function validatePromoCode(
  rawCode: string
): Promise<ValidatePromoResult> {
  const code = (rawCode || '').toUpperCase().trim();
  if (!code) {
    return { valid: false, reason: 'INVALID_FORMAT', message: 'Enter a promo code' };
  }
  // Basic format check: must look like our SAVE50-XXXXXX scheme OR a custom admin code (>= 4 chars).
  if (code.length < 4) {
    return { valid: false, reason: 'INVALID_FORMAT', message: 'Promo code is too short' };
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('code', '==', code),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { valid: false, reason: 'NOT_FOUND', message: 'Promo code not found' };
    }
    const docSnap = snap.docs[0];
    const data = docSnap.data() as PromoCodeRecord;

    if (data.redeemed) {
      return {
        valid: false,
        reason: 'ALREADY_REDEEMED',
        message: 'This promo code has already been used',
        docId: docSnap.id,
        code,
      };
    }

    const expiresAt =
      data.expiresAt instanceof Timestamp
        ? data.expiresAt.toDate()
        : new Date(data.expiresAt as unknown as string);
    if (expiresAt.getTime() < Date.now()) {
      return {
        valid: false,
        reason: 'EXPIRED',
        message: 'This promo code has expired',
        docId: docSnap.id,
        code,
        expiresAt,
      };
    }

    return {
      valid: true,
      code,
      amount: data.amount,
      expiresAt,
      docId: docSnap.id,
      message: `$${data.amount} discount applied`,
    };
  } catch (err) {
    return {
      valid: false,
      reason: 'ERROR',
      message:
        err instanceof Error ? err.message : 'Error validating promo code',
    };
  }
}

/**
 * Marks a promo code as redeemed. Should be called when the tier upgrade
 * checkout succeeds so the same code cannot be used twice.
 */
export async function redeemPromoCode(
  docId: string,
  redeemedBy?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, COLLECTION, docId), {
      redeemed: true,
      redeemedAt: serverTimestamp(),
      redeemedBy: redeemedBy || null,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to redeem promo code',
    };
  }
}
