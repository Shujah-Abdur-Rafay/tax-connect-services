// ============================================================================
// reviewsService — Firestore-backed client reviews for tax professionals.
//
// Replaces the dead Supabase `reviews` / `review_votes` tables (the old
// ReviewSubmissionForm wrote to a no-op stub, so submissions were silently
// dropped). Everything now lives in Firestore:
//
//   reviews/{reviewId}
//     professional_id            string   (UID of the reviewed pro)
//     client_id                  string   (UID of the reviewer)
//     client_name                string
//     client_email               string
//     rating                     number   (1..5)
//     title                      string
//     review_text                string
//     service_type               string | null
//     service_date               string | null
//     is_verified                boolean
//     helpful_count              number   (maintained by the onReviewVoteWrite fn)
//     not_helpful_count          number   (maintained by the onReviewVoteWrite fn)
//     professional_response      string | null
//     professional_response_date string | null  (ISO)
//     created_at                 Timestamp
//     updated_at                 Timestamp
//
//   review_votes/{reviewId}_{userId}
//     review_id                  string
//     user_id                    string
//     vote_type                  'helpful' | 'not_helpful'
//     created_at                 Timestamp
//
// `professionals/{id}.rating` + `.review_count` are recomputed by the
// onReviewWrite Cloud Function trigger (admin SDK) so the directory cards stay
// in sync without requiring reviewers to have write access to the pro's doc.
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const REVIEWS_COLLECTION = 'reviews';
export const REVIEW_VOTES_COLLECTION = 'review_votes';

export type ReviewVoteType = 'helpful' | 'not_helpful';

export interface Review {
  id: string;
  professional_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  rating: number;
  title: string;
  review_text: string;
  service_type: string | null;
  service_date: string | null;
  is_verified: boolean;
  helpful_count: number;
  not_helpful_count: number;
  professional_response: string | null;
  professional_response_date: string | null;
  /** Admin moderation flag — hidden reviews are withheld from public display. */
  is_hidden: boolean;
  created_at: string;
}

export interface SubmitReviewInput {
  professionalId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  rating: number;
  title: string;
  reviewText: string;
  serviceType?: string;
  serviceDate?: string;
  /** Verified = the reviewer actually has a completed order/booking with this pro. */
  isVerified?: boolean;
}

const tsToIso = (v: unknown): string => {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as any)?.toDate === 'function') {
    try {
      return (v as any).toDate().toISOString();
    } catch {
      /* fall through */
    }
  }
  if (typeof v === 'string') return v;
  return new Date(0).toISOString();
};

function normalizeReview(id: string, raw: any): Review {
  return {
    id,
    professional_id: raw.professional_id || '',
    client_id: raw.client_id || '',
    client_name: raw.client_name || 'Anonymous',
    client_email: raw.client_email || '',
    rating: Number(raw.rating || 0),
    title: raw.title || '',
    review_text: raw.review_text || '',
    service_type: raw.service_type ?? null,
    service_date: raw.service_date ?? null,
    is_verified: raw.is_verified === true,
    helpful_count: Number(raw.helpful_count || 0),
    not_helpful_count: Number(raw.not_helpful_count || 0),
    professional_response: raw.professional_response ?? null,
    professional_response_date: raw.professional_response_date
      ? tsToIso(raw.professional_response_date)
      : null,
    is_hidden: raw.is_hidden === true,
    created_at: tsToIso(raw.created_at),
  };
}

/**
 * Submit a new review. The professional's aggregate rating/review_count is
 * recomputed server-side by the onReviewWrite trigger — we do NOT write to the
 * pro's doc here (reviewers don't own it).
 */
export async function submitReview(input: SubmitReviewInput): Promise<Review> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.clientId) throw new Error('You must be signed in to submit a review.');
  if (!input.professionalId) throw new Error('Missing professional for this review.');
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  const payload = {
    professional_id: input.professionalId,
    client_id: input.clientId,
    client_name: input.clientName || 'Anonymous',
    client_email: input.clientEmail || '',
    rating,
    title: (input.title || '').slice(0, 160),
    review_text: (input.reviewText || '').slice(0, 4000),
    service_type: input.serviceType || null,
    service_date: input.serviceDate || null,
    is_verified: input.isVerified === true,
    helpful_count: 0,
    not_helpful_count: 0,
    professional_response: null,
    professional_response_date: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, REVIEWS_COLLECTION), payload);
  const snap = await getDoc(ref);
  return normalizeReview(ref.id, snap.data() || payload);
}

/** All publicly-visible reviews for a professional, newest first (hidden excluded). */
export async function getReviewsForProfessional(professionalId: string): Promise<Review[]> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!professionalId) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, REVIEWS_COLLECTION),
        where('professional_id', '==', professionalId),
        orderBy('created_at', 'desc')
      )
    );
    return snap.docs.map((d) => normalizeReview(d.id, d.data())).filter((r) => !r.is_hidden);
  } catch (e) {
    // Missing composite index / ordering can throw — retry unordered, sort in memory.
    console.warn('[reviewsService] ordered review query failed, retrying unordered:', e);
    const snap = await getDocs(
      query(collection(db, REVIEWS_COLLECTION), where('professional_id', '==', professionalId))
    );
    return snap.docs
      .map((d) => normalizeReview(d.id, d.data()))
      .filter((r) => !r.is_hidden)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin review moderation (Phase 5). Reads the whole collection (public read);
// hide/unhide + delete are gated to admins by Firestore rules.
// ─────────────────────────────────────────────────────────────────────────────

/** Every review across all professionals, newest first (includes hidden). */
export async function getAllReviews(): Promise<Review[]> {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    const snap = await getDocs(
      query(collection(db, REVIEWS_COLLECTION), orderBy('created_at', 'desc'))
    );
    return snap.docs.map((d) => normalizeReview(d.id, d.data()));
  } catch (e) {
    console.warn('[reviewsService] getAllReviews ordered query failed, retrying unordered:', e);
    const snap = await getDocs(collection(db, REVIEWS_COLLECTION));
    return snap.docs
      .map((d) => normalizeReview(d.id, d.data()))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

/** Admin: hide or un-hide a review (withholds it from public display). */
export async function adminSetReviewHidden(reviewId: string, hidden: boolean): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  await updateDoc(doc(db, REVIEWS_COLLECTION, reviewId), {
    is_hidden: hidden,
    moderated_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

/** Admin: permanently delete a review. */
export async function adminDeleteReview(reviewId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  await deleteDoc(doc(db, REVIEWS_COLLECTION, reviewId));
}

/** All reviews written by a given client (for the client dashboard), newest first. */
export async function getReviewsByClient(clientId: string): Promise<Review[]> {
  if (!db || !clientId) return [];
  try {
    const snap = await getDocs(
      query(collection(db, REVIEWS_COLLECTION), where('client_id', '==', clientId))
    );
    return snap.docs
      .map((d) => normalizeReview(d.id, d.data()))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (e) {
    console.warn('[reviewsService] getReviewsByClient failed:', (e as Error).message);
    return [];
  }
}

/** Map of reviewId -> the current user's vote, for highlighting the UI. */
export async function getUserVotes(userId: string): Promise<Record<string, ReviewVoteType>> {
  if (!db || !userId) return {};
  try {
    const snap = await getDocs(
      query(collection(db, REVIEW_VOTES_COLLECTION), where('user_id', '==', userId))
    );
    const map: Record<string, ReviewVoteType> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      if (data.review_id && data.vote_type) {
        map[data.review_id] = data.vote_type;
      }
    });
    return map;
  } catch (e) {
    console.warn('[reviewsService] getUserVotes failed:', e);
    return {};
  }
}

/**
 * Toggle a helpful / not-helpful vote. Each user has at most one vote per
 * review, stored at `review_votes/{reviewId}_{userId}`. Clicking the same vote
 * again clears it. The helpful_count / not_helpful_count on the review are
 * recomputed by the onReviewVoteWrite Cloud Function trigger.
 *
 * Returns the user's resulting vote (or null if it was cleared).
 */
export async function voteOnReview(
  reviewId: string,
  userId: string,
  voteType: ReviewVoteType
): Promise<ReviewVoteType | null> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!userId) throw new Error('You must be signed in to vote.');

  const voteRef = doc(db, REVIEW_VOTES_COLLECTION, `${reviewId}_${userId}`);
  const existing = await getDoc(voteRef);

  if (existing.exists() && (existing.data() as any)?.vote_type === voteType) {
    // Same vote clicked → clear it.
    await deleteDoc(voteRef);
    return null;
  }

  await setDoc(voteRef, {
    review_id: reviewId,
    user_id: userId,
    vote_type: voteType,
    created_at: serverTimestamp(),
  });
  return voteType;
}

/**
 * Professional responds to a review. Only the reviewed professional should be
 * able to call this; Firestore rules enforce `auth.uid == professional_id`.
 */
export async function respondToReview(reviewId: string, response: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  const text = (response || '').trim();
  if (!text) throw new Error('Response cannot be empty.');
  await updateDoc(doc(db, REVIEWS_COLLECTION, reviewId), {
    professional_response: text.slice(0, 4000),
    professional_response_date: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

/** Convenience: average rating + count computed from a list of reviews. */
export function summarizeReviews(reviews: Review[]): { average: number; count: number } {
  if (!reviews.length) return { average: 0, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return { average: sum / reviews.length, count: reviews.length };
}
