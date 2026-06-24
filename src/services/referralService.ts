/**
 * referralService — Refer-a-friend program.
 *
 * Data model (Firestore):
 *
 *   referral_codes/{uid}
 *     code: string         // human-friendly, 8-char base32, unique-by-uid
 *     uid: string          // owner
 *     created_at: ts
 *
 *   referrals/{auto-id}
 *     referrer_uid: string         // who shared the code
 *     referrer_code: string        // the code the friend used
 *     referred_uid: string         // the friend (set on signup)
 *     referred_email?: string
 *     referred_name?: string
 *     status: 'pending' | 'completed'
 *     credit_amount?: number       // $25 once completed
 *     first_paid_order_id?: string // gig_orders doc id that triggered completion
 *     created_at: ts
 *     completed_at?: ts
 *
 *   user_credits/{uid}
 *     uid: string
 *     balance_cents: number   // unspent referral credit, in cents
 *     lifetime_cents: number  // total ever earned
 *     updated_at: ts
 *
 * Rules of the program:
 *  - Each user has ONE permanent referral code (derived from uid, persisted on
 *    first read so the same value is always returned).
 *  - A friend "uses" the code by signing up with ?ref=CODE — we write a
 *    referrals row with status='pending'.
 *  - The referral flips to 'completed' the first time the referred user has a
 *    gig_order whose payment confirms (see gigOrdersService.confirmOrderPayment
 *    side-effect). At that moment we add $25 credit to the referrer's
 *    user_credits doc.
 *  - Self-referrals (referrer_uid === referred_uid) are rejected.
 *  - A given referred_uid can only generate ONE referral row, ever (we
 *    short-circuit on duplicate).
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const REFERRAL_CREDIT_USD = 25;
const REFERRAL_CREDIT_CENTS = REFERRAL_CREDIT_USD * 100;

export type ReferralStatus = 'pending' | 'completed';

export interface ReferralRecord {
  id: string;
  referrer_uid: string;
  referrer_code: string;
  referred_uid: string;
  referred_email?: string;
  referred_name?: string;
  status: ReferralStatus;
  credit_amount?: number;
  first_paid_order_id?: string;
  created_at?: string;
  completed_at?: string;
}

export interface UserCredits {
  uid: string;
  balance_cents: number;
  lifetime_cents: number;
  updated_at?: string;
}

export interface ReferralStats {
  code: string;
  link: string;
  totalReferred: number;
  pending: number;
  completed: number;
  totalEarnedUsd: number;
  balanceUsd: number;
  referrals: ReferralRecord[];
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

/**
 * Deterministically generate a short, human-friendly referral code from a
 * Firebase UID. We hash the uid to a stable 8-char base32 string. Same uid in,
 * same code out — which means we can recompute it any time without a
 * round-trip. We still persist it to `referral_codes/{uid}` so it appears in
 * the codes collection and reverse-lookups (`findReferrerByCode`) work.
 */
function deriveCodeFromUid(uid: string): string {
  // FNV-1a 32-bit hash → base32 chunked to 8 chars. Collision risk on 8 chars
  // of base32 is ~1 in a billion which is fine for our scale.
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < uid.length; i++) {
    h1 ^= uid.charCodeAt(i);
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 ^= uid.charCodeAt(i) * 31;
    h2 = Math.imul(h2, 2246822519) >>> 0;
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const combined = (BigInt(h1) << 32n) | BigInt(h2);
  let n = combined;
  let out = '';
  for (let i = 0; i < 8; i++) {
    out = alphabet[Number(n % 32n)] + out;
    n = n / 32n;
  }
  return out;
}

/**
 * Get the user's permanent referral code, creating + persisting the doc on
 * first call. Safe to call on every page load — subsequent calls are a single
 * getDoc.
 */
export async function getOrCreateReferralCode(uid: string): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');
  if (!uid) throw new Error('Missing uid');

  const ref = doc(db, 'referral_codes', uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data()?.code) {
    return String(snap.data()!.code);
  }
  const code = deriveCodeFromUid(uid);
  await setDoc(
    ref,
    {
      uid,
      code,
      created_at: serverTimestamp(),
    },
    { merge: true }
  );
  return code;
}

/**
 * Reverse lookup: given a code, find the uid of the referrer who owns it.
 * Returns null if no match.
 *
 * Because codes are deterministic, we don't strictly need an index — but
 * persisting the code doc lets us query by `code` field in case codes ever
 * become non-deterministic (e.g. user customisation in the future).
 */
export async function findReferrerByCode(code: string): Promise<string | null> {
  if (!db) throw new Error('Firestore not initialized');
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const q = query(
    collection(db, 'referral_codes'),
    where('code', '==', normalized),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data() as any;
  return data?.uid || null;
}

/**
 * Called on signup if `?ref=CODE` was present (and stored in localStorage).
 * Creates a pending referrals row tying the new user to the referrer.
 *
 * Idempotent: if the referred_uid already has a referral row, we no-op.
 * Self-referrals are silently dropped (no row written, no error thrown).
 */
export async function recordReferralSignup(input: {
  referredUid: string;
  referredEmail?: string;
  referredName?: string;
  referrerCode: string;
}): Promise<ReferralRecord | null> {
  if (!db) throw new Error('Firestore not initialized');
  if (!input.referredUid || !input.referrerCode) return null;

  const code = input.referrerCode.trim().toUpperCase();
  const referrerUid = await findReferrerByCode(code);
  if (!referrerUid) {
    console.warn('[referralService] unknown referral code on signup:', code);
    return null;
  }
  if (referrerUid === input.referredUid) {
    console.warn('[referralService] self-referral blocked');
    return null;
  }

  // Idempotency — has this referred_uid already been claimed?
  const existing = await getDocs(
    query(
      collection(db, 'referrals'),
      where('referred_uid', '==', input.referredUid),
      limit(1)
    )
  );
  if (!existing.empty) {
    const d = existing.docs[0];
    return docToReferral(d.id, d.data());
  }

  const payload: any = {
    referrer_uid: referrerUid,
    referrer_code: code,
    referred_uid: input.referredUid,
    referred_email: input.referredEmail || null,
    referred_name: input.referredName || null,
    status: 'pending' as ReferralStatus,
    created_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'referrals'), payload);
  const fresh = await getDoc(ref);
  return docToReferral(ref.id, fresh.data() || payload);
}

const docToReferral = (id: string, data: any): ReferralRecord => ({
  id,
  referrer_uid: data?.referrer_uid || '',
  referrer_code: data?.referrer_code || '',
  referred_uid: data?.referred_uid || '',
  referred_email: data?.referred_email || undefined,
  referred_name: data?.referred_name || undefined,
  status: (data?.status as ReferralStatus) || 'pending',
  credit_amount: typeof data?.credit_amount === 'number' ? data.credit_amount : undefined,
  first_paid_order_id: data?.first_paid_order_id || undefined,
  created_at: tsToIso(data?.created_at),
  completed_at: tsToIso(data?.completed_at),
});

/**
 * Fetch all referrals the user has SENT (as the referrer). Ordered most-
 * recent first. Falls back to unordered fetch if the composite index isn't
 * available yet.
 */
export async function getReferralsForUser(uid: string): Promise<ReferralRecord[]> {
  if (!db) throw new Error('Firestore not initialized');
  if (!uid) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'referrals'),
        where('referrer_uid', '==', uid),
        orderBy('created_at', 'desc')
      )
    );
    return snap.docs.map((d) => docToReferral(d.id, d.data()));
  } catch (e) {
    console.warn('[referralService] ordered query failed, retrying unordered', e);
    const snap = await getDocs(
      query(collection(db, 'referrals'), where('referrer_uid', '==', uid))
    );
    const arr = snap.docs.map((d) => docToReferral(d.id, d.data()));
    arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return arr;
  }
}

/**
 * Find the referrer (if any) for a given referred uid. Used by the post-
 * payment hook to figure out who to credit.
 */
async function getReferralForReferredUid(referredUid: string): Promise<ReferralRecord | null> {
  if (!db) return null;
  if (!referredUid) return null;
  const snap = await getDocs(
    query(
      collection(db, 'referrals'),
      where('referred_uid', '==', referredUid),
      limit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return docToReferral(d.id, d.data());
}

/**
 * Get the user's credit doc, creating it as zero-balance on first read.
 */
export async function getUserCredits(uid: string): Promise<UserCredits> {
  if (!db) throw new Error('Firestore not initialized');
  if (!uid) throw new Error('Missing uid');
  const ref = doc(db, 'user_credits', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { uid, balance_cents: 0, lifetime_cents: 0 };
  }
  const data = snap.data() as any;
  return {
    uid,
    balance_cents: Number(data?.balance_cents || 0),
    lifetime_cents: Number(data?.lifetime_cents || 0),
    updated_at: tsToIso(data?.updated_at),
  };
}

/**
 * Called from gigOrdersService.confirmOrderPayment as a fire-and-forget side
 * effect. If the buying client was referred AND this is their first paid
 * order, we:
 *   1. Flip the referrals row to status='completed'
 *   2. Increment the referrer's user_credits balance by $25
 *
 * Wrapped in a Firestore transaction so the credit can't be double-awarded
 * even if confirmOrderPayment races with itself. Errors are swallowed —
 * referral credit is a soft side-effect and must never undo a real payment
 * confirmation.
 */
export async function awardReferralOnFirstPaidOrder(input: {
  referredUid: string;
  orderId: string;
}): Promise<void> {
  if (!db) return;
  if (!input.referredUid || !input.orderId) return;

  try {
    const referral = await getReferralForReferredUid(input.referredUid);
    if (!referral) return; // not referred by anyone
    if (referral.status === 'completed') return; // already awarded

    const referralRef = doc(db, 'referrals', referral.id);
    const creditsRef = doc(db, 'user_credits', referral.referrer_uid);

    await runTransaction(db, async (tx) => {
      const referralSnap = await tx.get(referralRef);
      if (!referralSnap.exists()) return;
      const referralData = referralSnap.data() as any;
      // Guard against race: another tab may have already completed this.
      if (referralData?.status === 'completed') return;

      tx.update(referralRef, {
        status: 'completed',
        credit_amount: REFERRAL_CREDIT_USD,
        first_paid_order_id: input.orderId,
        completed_at: serverTimestamp(),
      });

      // Upsert credits doc — set() with merge:true is atomic via transaction.
      const creditsSnap = await tx.get(creditsRef);
      if (creditsSnap.exists()) {
        tx.update(creditsRef, {
          balance_cents: increment(REFERRAL_CREDIT_CENTS),
          lifetime_cents: increment(REFERRAL_CREDIT_CENTS),
          updated_at: serverTimestamp(),
        });
      } else {
        tx.set(creditsRef, {
          uid: referral.referrer_uid,
          balance_cents: REFERRAL_CREDIT_CENTS,
          lifetime_cents: REFERRAL_CREDIT_CENTS,
          updated_at: serverTimestamp(),
        });
      }
    });
  } catch (e) {
    console.warn('[referralService] failed to award referral credit (non-fatal)', e);
  }
}

/**
 * High-level dashboard fetch — code, link, stats, list of referrals, credit
 * balance — in one call. Used by /refer.
 */
export async function getReferralStats(
  uid: string,
  origin?: string
): Promise<ReferralStats> {
  const [code, referrals, credits] = await Promise.all([
    getOrCreateReferralCode(uid),
    getReferralsForUser(uid),
    getUserCredits(uid),
  ]);

  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const link = `${base}/?ref=${encodeURIComponent(code)}`;

  const completed = referrals.filter((r) => r.status === 'completed').length;
  const pending = referrals.length - completed;

  return {
    code,
    link,
    totalReferred: referrals.length,
    pending,
    completed,
    totalEarnedUsd: credits.lifetime_cents / 100,
    balanceUsd: credits.balance_cents / 100,
    referrals,
  };
}

/**
 * Tiny localStorage helper — when a visitor lands on the site with ?ref=CODE
 * we stash it here so we can attach the referral on signup (which may happen
 * minutes or days later, after they've clicked around).
 */
const REFERRAL_LS_KEY = 'rc_pending_referral_code';
const REFERRAL_LS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function capturePendingReferralCode(code: string): void {
  if (typeof window === 'undefined' || !code) return;
  try {
    localStorage.setItem(
      REFERRAL_LS_KEY,
      JSON.stringify({ code: code.trim().toUpperCase(), at: Date.now() })
    );
  } catch {
    /* ignore quota errors */
  }
}

export function readPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REFERRAL_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return null;
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > REFERRAL_LS_TTL_MS) {
      localStorage.removeItem(REFERRAL_LS_KEY);
      return null;
    }
    return String(parsed.code).toUpperCase();
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REFERRAL_LS_KEY);
  } catch {
    /* ignore */
  }
}
