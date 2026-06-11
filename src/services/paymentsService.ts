// ============================================================================
// paymentsService — unified payment-history ledger, backed by Firestore
// `payments`. Powers the member portal "Payments" tab and feeds platform
// revenue analytics.
//
// Firestore schema (payments/{id}):
//   user_uid                 — uid the payment belongs to (rule: own rows)
//   amount                   — number, in the currency's major unit (dollars)
//   currency                 — ISO code, e.g. 'usd'
//   status                   — 'succeeded' | 'pending' | 'failed'
//   paymentType              — 'subscription' | 'document_processing' | 'service_fee'
//   description              — human-readable line item
//   stripe_payment_intent_id — optional Stripe PI reference
//   created_at               — serverTimestamp
//
// NOTE: the authoritative payment record is written server-side by the Stripe
// webhook (admin SDK) once Cloud Functions are deployed. recordPayment() lets
// the client optimistically log a payment it just confirmed so the history is
// populated in the meantime; records are immutable (no update/delete).
// ============================================================================

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COLLECTION = 'payments';

export type PaymentStatus = 'succeeded' | 'pending' | 'failed';
export type PaymentType = 'subscription' | 'document_processing' | 'service_fee';

export interface PaymentRecord {
  id: string;
  user_uid: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: PaymentType;
  description: string;
  stripe_payment_intent_id?: string | null;
  created_at?: string;
}

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

const docToPayment = (id: string, data: any): PaymentRecord => ({
  id,
  user_uid: data.user_uid || '',
  amount: Number(data.amount || 0),
  currency: (data.currency || 'usd').toString(),
  status: (data.status as PaymentStatus) || 'succeeded',
  paymentType: (data.paymentType as PaymentType) || 'service_fee',
  description: data.description || '',
  stripe_payment_intent_id: data.stripe_payment_intent_id ?? null,
  created_at: tsToIso(data.created_at),
});

export interface RecordPaymentInput {
  userUid: string;
  amount: number;
  currency?: string;
  status?: PaymentStatus;
  paymentType: PaymentType;
  description: string;
  stripePaymentIntentId?: string;
}

/** Append a payment record the client just confirmed. Never throws. */
export async function recordPayment(input: RecordPaymentInput): Promise<void> {
  if (!db || !input.userUid) return;
  try {
    await addDoc(collection(db, COLLECTION), {
      user_uid: input.userUid,
      amount: Number(input.amount || 0),
      currency: (input.currency || 'usd').toLowerCase(),
      status: input.status || 'succeeded',
      paymentType: input.paymentType,
      description: input.description,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      created_at: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[paymentsService] recordPayment failed:', e);
  }
}

/** A user's payments, newest first. Falls back to unordered if the index is building. */
export async function fetchPaymentsForUser(uid: string): Promise<PaymentRecord[]> {
  if (!db || !uid) return [];
  try {
    let snap;
    try {
      snap = await getDocs(
        query(
          collection(db, COLLECTION),
          where('user_uid', '==', uid),
          orderBy('created_at', 'desc'),
        ),
      );
    } catch {
      snap = await getDocs(query(collection(db, COLLECTION), where('user_uid', '==', uid)));
    }
    return snap.docs
      .map((d) => docToPayment(d.id, d.data()))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch (e) {
    console.warn('[paymentsService] fetchPaymentsForUser failed:', e);
    return [];
  }
}

/** Every payment platform-wide (admin analytics). Capped for safety. */
export async function fetchAllPayments(max = 2000): Promise<PaymentRecord[]> {
  if (!db) return [];
  try {
    let snap;
    try {
      snap = await getDocs(
        query(collection(db, COLLECTION), orderBy('created_at', 'desc'), fsLimit(max)),
      );
    } catch {
      snap = await getDocs(query(collection(db, COLLECTION), fsLimit(max)));
    }
    return snap.docs.map((d) => docToPayment(d.id, d.data()));
  } catch (e) {
    console.warn('[paymentsService] fetchAllPayments failed:', e);
    return [];
  }
}
