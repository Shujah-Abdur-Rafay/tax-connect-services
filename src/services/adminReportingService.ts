// ============================================================================
// adminReportingService — Phase 5 admin monitoring queries
//
// Admin-wide reads that power the admin dashboard's payout/commission monitor
// and subscription manager. These rely on admin-scoped Firestore rules:
//   - gig_orders   : read allowed to the two parties OR an admin
//   - professionals: public read (already)
//
// Everything is read-only aggregation; no writes happen here.
// ============================================================================

import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

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

export interface AdminGigOrder {
  id: string;
  gig_title: string;
  pro_id: string;
  pro_name: string | null;
  client_name: string | null;
  price: number;
  status: string;
  payment_status: string;
  refund_amount: number | null;
  created_at?: string;
  paid_at?: string;
}

/** Read every gig order (admin-only). Newest first. */
export async function getAllGigOrdersForAdmin(): Promise<AdminGigOrder[]> {
  if (!db) return [];
  const mapDoc = (id: string, data: any): AdminGigOrder => ({
    id,
    gig_title: data.gig_title || 'Gig order',
    pro_id: data.pro_id || '',
    pro_name: data.pro_name ?? null,
    client_name: data.client_name ?? null,
    price: Number(data.price || data.tier?.price || 0),
    status: data.status || 'new',
    payment_status: data.payment_status || 'unpaid',
    refund_amount: typeof data.refund_amount === 'number' ? data.refund_amount : null,
    created_at: tsToIso(data.created_at),
    paid_at: tsToIso(data.paid_at),
  });
  try {
    const snap = await getDocs(query(collection(db, 'gig_orders'), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
  } catch (e) {
    console.warn('[adminReportingService] getAllGigOrdersForAdmin ordered query failed:', (e as Error).message);
    try {
      const snap = await getDocs(collection(db, 'gig_orders'));
      return snap.docs
        .map((d) => mapDoc(d.id, d.data()))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } catch (e2) {
      console.warn('[adminReportingService] getAllGigOrdersForAdmin failed:', (e2 as Error).message);
      return [];
    }
  }
}

export interface CommissionReport {
  gross: number;
  platformCommission: number;
  proNet: number;
  refundedTotal: number;
  paidOrders: number;
  refundedOrders: number;
  /** Per-pro breakdown, sorted by gross desc. */
  byPro: { proId: string; proName: string; gross: number; commission: number; orders: number }[];
}

/** Aggregate platform commission across all paid gig orders at the given fee %. */
export function buildCommissionReport(
  orders: AdminGigOrder[],
  feePercent: number,
): CommissionReport {
  const paid = orders.filter((o) => o.payment_status === 'paid');
  const refunded = orders.filter((o) => o.payment_status === 'refunded');

  const gross = paid.reduce((s, o) => s + o.price, 0);
  const platformCommission = gross * (feePercent / 100);
  const proNet = gross - platformCommission;
  const refundedTotal = refunded.reduce((s, o) => s + (o.refund_amount ?? o.price), 0);

  const proMap = new Map<string, { proId: string; proName: string; gross: number; orders: number }>();
  for (const o of paid) {
    const key = o.pro_id || 'unknown';
    const prev = proMap.get(key) || { proId: key, proName: o.pro_name || 'Unknown pro', gross: 0, orders: 0 };
    prev.gross += o.price;
    prev.orders += 1;
    proMap.set(key, prev);
  }
  const byPro = Array.from(proMap.values())
    .map((p) => ({ ...p, commission: p.gross * (feePercent / 100) }))
    .sort((a, b) => b.gross - a.gross);

  return {
    gross,
    platformCommission,
    proNet,
    refundedTotal,
    paidOrders: paid.length,
    refundedOrders: refunded.length,
    byPro,
  };
}

export interface AdminSubscription {
  id: string;
  name: string;
  email: string;
  membershipLevel: string | null;
  membershipTier: string | null;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

/**
 * Every professional that has any Stripe subscription / customer footprint —
 * used by the admin subscription monitor. Professionals are publicly readable.
 */
export async function getSubscriptionProfessionals(): Promise<AdminSubscription[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'professionals'));
    const rows: AdminSubscription[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, any>;
      const hasSub = !!(data.stripeSubscriptionId || data.subscriptionStatus || data.stripeCustomerId);
      if (!hasSub) return;
      rows.push({
        id: d.id,
        name: data.full_name || data.email || 'Professional',
        email: data.email || '',
        membershipLevel: data.membership_level ?? null,
        membershipTier: data.membershipTier ?? null,
        subscriptionStatus: data.subscriptionStatus ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripeCustomerId: data.stripeCustomerId ?? null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
        currentPeriodEnd: tsToIso(data.currentPeriodEnd) ?? null,
      });
    });
    // Active first, then by name.
    const rank: Record<string, number> = { active: 0, trialing: 1, past_due: 2, paused: 3, canceled: 4 };
    return rows.sort((a, b) => {
      const ra = rank[a.subscriptionStatus || ''] ?? 5;
      const rb = rank[b.subscriptionStatus || ''] ?? 5;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  } catch (e) {
    console.warn('[adminReportingService] getSubscriptionProfessionals failed:', (e as Error).message);
    return [];
  }
}
