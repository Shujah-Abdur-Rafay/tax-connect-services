import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { taxGigs, type TaxGig, type GigTier } from '@/data/taxGigs';

export type GigStatus = 'draft' | 'published' | 'paused';

/**
 * GigRecord keeps the same snake_case shape that the rest of the app
 * (ProGigsManager, GigFormModal) already reads from. Internally we store the
 * same fields in Firestore so we don't have to touch any callers.
 */
export interface GigRecord {
  id: string;
  pro_id: string;
  pro_email?: string | null;
  pro_name?: string | null;
  pro_title?: string | null;
  pro_avatar?: string | null;
  pro_badge?: string | null;
  slug: string;
  title: string;
  category: string;
  image?: string | null;
  short_description: string;
  tags: string[];
  tiers: GigTier[];
  response_time?: string | null;
  available_now: boolean;
  status: GigStatus;
  rating?: number | null;
  review_count?: number | null;
  orders_in_queue?: number | null;
  filed_this_season?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface GigInput {
  proId: string;
  proEmail?: string;
  proName?: string;
  proTitle?: string;
  proAvatar?: string;
  proBadge?: string;
  slug: string;
  title: string;
  category: string;
  image?: string;
  shortDescription: string;
  tags: string[];
  tiers: GigTier[];
  responseTime?: string;
  availableNow: boolean;
  status: GigStatus;
}

const COLLECTION = 'gigs';

// ---------- Mapping ----------
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

const docToRecord = (id: string, data: any): GigRecord => ({
  id,
  pro_id: data.pro_id || '',
  pro_email: data.pro_email ?? null,
  pro_name: data.pro_name ?? null,
  pro_title: data.pro_title ?? null,
  pro_avatar: data.pro_avatar ?? null,
  pro_badge: data.pro_badge ?? 'New & Noted',
  slug: data.slug || '',
  title: data.title || '',
  category: data.category || 'individual',
  image: data.image ?? null,
  short_description: data.short_description || '',
  tags: Array.isArray(data.tags) ? data.tags : [],
  tiers: Array.isArray(data.tiers) ? data.tiers : [],
  response_time: data.response_time ?? 'Responds in a few hours',
  available_now: !!data.available_now,
  status: (data.status as GigStatus) || 'draft',
  rating: data.rating ?? 0,
  review_count: data.review_count ?? 0,
  orders_in_queue: data.orders_in_queue ?? 0,
  filed_this_season: data.filed_this_season ?? 0,
  created_at: tsToIso(data.created_at),
  updated_at: tsToIso(data.updated_at),
});

export const recordToTaxGig = (r: GigRecord): TaxGig => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  category: (r.category as TaxGig['category']) || 'individual',
  proId: r.pro_id,
  proName: r.pro_name || 'Tax Professional',
  proTitle: r.pro_title || 'Tax Professional',
  proAvatar:
    r.pro_avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.pro_name || 'Pro')}&backgroundColor=3b82f6,8b5cf6,06b6d4,10b981,f59e0b`,
  proBadge: (r.pro_badge as TaxGig['proBadge']) || 'New & Noted',
  responseTime: r.response_time || 'Responds in a few hours',
  rating: Number(r.rating || 0),
  reviewCount: Number(r.review_count || 0),
  ordersInQueue: Number(r.orders_in_queue || 0),
  filedThisSeason: Number(r.filed_this_season || 0),
  image:
    r.image ||
    'https://d64gsuwffb70l.cloudfront.net/68a3939608e7f1e2bfd480c9_1778859891827_b72c9aac.jpg',
  shortDescription: r.short_description || '',
  tags: Array.isArray(r.tags) ? r.tags : [],
  tiers: Array.isArray(r.tiers) ? r.tiers : [],
  availableNow: !!r.available_now,
});

const inputToDoc = (g: GigInput) => ({
  pro_id: g.proId,
  pro_email: g.proEmail ?? null,
  pro_name: g.proName ?? null,
  pro_title: g.proTitle ?? null,
  pro_avatar: g.proAvatar ?? null,
  pro_badge: g.proBadge ?? 'New & Noted',
  slug: g.slug,
  title: g.title,
  category: g.category,
  image: g.image ?? null,
  short_description: g.shortDescription,
  tags: g.tags || [],
  tiers: g.tiers || [],
  response_time: g.responseTime ?? 'Responds in a few hours',
  available_now: !!g.availableNow,
  status: g.status,
});

// ---------- Public marketplace feed (with fallback to seed) ----------
export async function fetchPublishedGigs(): Promise<{ gigs: TaxGig[]; usingFallback: boolean }> {
  try {
    if (!db) {
      return { gigs: taxGigs, usingFallback: true };
    }
    // Try ordered query first; fall back to unordered if the index isn't ready.
    let snap;
    try {
      const q = query(
        collection(db, COLLECTION),
        where('status', '==', 'published'),
        orderBy('created_at', 'desc')
      );
      snap = await getDocs(q);
    } catch (innerErr) {
      console.warn('[gigsService] ordered query failed, retrying unordered:', innerErr);
      const q = query(collection(db, COLLECTION), where('status', '==', 'published'));
      snap = await getDocs(q);
    }
    if (snap.empty) {
      return { gigs: taxGigs, usingFallback: true };
    }
    const records = snap.docs.map((d) => docToRecord(d.id, d.data()));
    // Client-side sort fallback by created_at desc
    records.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return {
      gigs: records.map(recordToTaxGig),
      usingFallback: false,
    };
  } catch (e) {
    console.warn('[gigsService] fetchPublishedGigs error, using seed data:', e);
    return { gigs: taxGigs, usingFallback: true };
  }
}

// ---------- Pro management ----------
export async function fetchGigsForPro(proId: string): Promise<GigRecord[]> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!proId) return [];
  let snap;
  try {
    const q = query(
      collection(db, COLLECTION),
      where('pro_id', '==', proId),
      orderBy('created_at', 'desc')
    );
    snap = await getDocs(q);
  } catch (innerErr) {
    console.warn('[gigsService] ordered pro query failed, retrying unordered:', innerErr);
    const q = query(collection(db, COLLECTION), where('pro_id', '==', proId));
    snap = await getDocs(q);
  }
  const records = snap.docs.map((d) => docToRecord(d.id, d.data()));
  records.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return records;
}

export async function createGig(input: GigInput): Promise<GigRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.proId) throw new Error('Missing proId — must be logged in to create a gig.');
  const payload = {
    ...inputToDoc(input),
    rating: 0,
    review_count: 0,
    orders_in_queue: 0,
    filed_this_season: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  const snap = await getDoc(ref);
  return docToRecord(ref.id, snap.data() || payload);
}

export async function updateGig(id: string, proId: string, input: GigInput): Promise<GigRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!proId) throw new Error('Not authenticated');
  const ref = doc(db, COLLECTION, id);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Gig not found');
  const data = existing.data() as any;
  if (data.pro_id !== proId) {
    throw new Error('You can only edit your own gigs.');
  }
  await updateDoc(ref, {
    ...inputToDoc(input),
    updated_at: serverTimestamp(),
  });
  const fresh = await getDoc(ref);
  return docToRecord(ref.id, fresh.data() || {});
}

export async function setGigStatus(id: string, proId: string, status: GigStatus): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!proId) throw new Error('Not authenticated');
  const ref = doc(db, COLLECTION, id);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Gig not found');
  const data = existing.data() as any;
  if (data.pro_id !== proId) {
    throw new Error('You can only update your own gigs.');
  }
  await updateDoc(ref, { status, updated_at: serverTimestamp() });
}

export async function deleteGig(id: string, proId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!proId) throw new Error('Not authenticated');
  const ref = doc(db, COLLECTION, id);
  const existing = await getDoc(ref);
  if (!existing.exists()) return;
  const data = existing.data() as any;
  if (data.pro_id !== proId) {
    throw new Error('You can only delete your own gigs.');
  }
  await deleteDoc(ref);
}

// ---------- Helpers ----------
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function emptyTiers(): GigTier[] {
  return [
    { name: 'Basic', price: 99, deliveryDays: 3, revisions: 1, description: '', features: [''] },
    { name: 'Standard', price: 199, deliveryDays: 2, revisions: 2, description: '', features: [''] },
    { name: 'Premium', price: 399, deliveryDays: 1, revisions: 'Unlimited', description: '', features: [''] },
  ];
}
