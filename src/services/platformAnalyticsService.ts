// ============================================================================
// platformAnalyticsService — PLATFORM-WIDE analytics computed live from real
// Firestore collections (no mock data). Powers the admin Analytics Dashboard.
//
// Sources:
//   gig_orders      — orders/bookings + revenue (paid) + popular services + retention
//   appointments    — bookings
//   reviews         — average rating + ratings-over-time   (via reviewsService)
//   payments        — additional revenue (subscriptions / doc processing)
//   profile_views   — funnel top (views → bookings = conversion)
//
// Admins can list these collections platform-wide (see firestore.rules
// isAdmin()). All aggregation is done client-side over a capped fetch — fine at
// current scale; revisit with server-side aggregation if volume grows.
// ============================================================================

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAllReviews, summarizeReviews } from '@/services/reviewsService';
import { fetchAllPayments } from '@/services/paymentsService';

const FETCH_CAP = 2000;

export interface AnalyticsMetrics {
  totalBookings: number;
  totalRevenue: number;
  avgRating: number;
  retentionRate: number;
  profileViews: number;
  conversionRate: number;
}

export interface AnalyticsDeltas {
  bookings?: number;
  revenue?: number;
  rating?: number;
}

export interface AnalyticsResult {
  metrics: AnalyticsMetrics;
  deltas: AnalyticsDeltas;
  revenueData: { date: string; revenue: number }[];
  bookingsData: { time: string; bookings: number }[];
  servicesData: { name: string; value: number }[];
  ratingsData: { month: string; rating: number }[];
}

/** % change current vs previous; 0 baseline → 100% if grown, else 0. */
const pctChange = (curr: number, prev: number): number => {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toMillis = (v: unknown): number | null => {
  if (v == null) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof (v as any)?.toMillis === 'function') {
    try {
      return (v as any).toMillis();
    } catch {
      /* ignore */
    }
  }
  if (typeof (v as any)?.seconds === 'number') return (v as any).seconds * 1000;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

/** Best-effort created/occurred timestamp for a doc across our varying schemas. */
const docTimeMs = (d: any): number | null =>
  toMillis(d.created_at) ??
  toMillis(d.createdAt) ??
  toMillis(d.paid_at) ??
  toMillis(d.appointment_date) ??
  toMillis(d.date) ??
  null;

async function fetchCollection(name: string): Promise<any[]> {
  if (!db) return [];
  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, name), orderBy('created_at', 'desc'), fsLimit(FETCH_CAP)));
    } catch {
      snap = await getDocs(query(collection(db, name), fsLimit(FETCH_CAP)));
    }
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  } catch (e) {
    console.warn(`[platformAnalytics] could not read "${name}" (rules / permissions?):`, e);
    return [];
  }
}

const inRange = (ms: number | null, from: number, to: number): boolean =>
  ms != null && ms >= from && ms <= to;

const isPaidOrder = (o: any): boolean =>
  o.payment_status === 'paid' || o.status === 'completed' || o.status === 'delivered';

/**
 * Compute the full analytics payload over the given date range. Headline metrics
 * respect the range; the revenue/ratings trend charts always show the trailing
 * 6 calendar months so the lines are meaningful regardless of the picker.
 */
export async function fetchPlatformAnalytics(range: {
  from: Date;
  to: Date;
}): Promise<AnalyticsResult> {
  const from = range.from.getTime();
  const to = range.to.getTime();

  const [gigOrders, appointments, profileViewsDocs, reviews, payments] = await Promise.all([
    fetchCollection('gig_orders'),
    fetchCollection('appointments'),
    fetchCollection('profile_views'),
    getAllReviews().catch(() => []),
    fetchAllPayments(FETCH_CAP).catch(() => []),
  ]);

  // ── Headline metrics (within range) ──────────────────────────────────────
  const ordersInRange = gigOrders.filter((o) => inRange(docTimeMs(o), from, to));
  const apptsInRange = appointments.filter((a) => inRange(docTimeMs(a), from, to));
  const paymentsInRange = payments.filter((p) => inRange(docTimeMs(p), from, to));
  const viewsInRange = profileViewsDocs.filter((v) => inRange(docTimeMs(v), from, to));

  const totalBookings = ordersInRange.length + apptsInRange.length;

  const orderRevenue = ordersInRange
    .filter(isPaidOrder)
    .reduce((sum, o) => sum + Number(o.price ?? o.tier?.price ?? 0), 0);
  const paymentRevenue = paymentsInRange
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const apptRevenue = apptsInRange.reduce(
    (sum, a) => sum + Number(a.amount ?? a.price ?? a.total ?? 0),
    0,
  );
  const totalRevenue = Math.round((orderRevenue + paymentRevenue + apptRevenue) * 100) / 100;

  const { average: avgRating } = summarizeReviews(reviews as any[]);

  // Retention: share of paying clients who placed more than one paid order.
  const paidByClient = new Map<string, number>();
  gigOrders.filter(isPaidOrder).forEach((o) => {
    const c = o.client_uid || o.client_id;
    if (c) paidByClient.set(c, (paidByClient.get(c) || 0) + 1);
  });
  const distinctClients = paidByClient.size;
  const returningClients = [...paidByClient.values()].filter((n) => n > 1).length;
  const retentionRate = distinctClients > 0
    ? Math.round((returningClients / distinctClients) * 1000) / 10
    : 0;

  const profileViews = viewsInRange.length;
  const conversionRate = profileViews > 0
    ? Math.round((totalBookings / profileViews) * 1000) / 10
    : 0;

  // ── Period-over-period deltas (vs the immediately preceding equal window) ──
  const span = Math.max(1, to - from);
  const pFrom = from - span;
  const pTo = from;
  const prevOrders = gigOrders.filter((o) => inRange(docTimeMs(o), pFrom, pTo));
  const prevAppts = appointments.filter((a) => inRange(docTimeMs(a), pFrom, pTo));
  const prevBookings = prevOrders.length + prevAppts.length;
  const prevRevenue =
    prevOrders.filter(isPaidOrder).reduce((s, o) => s + Number(o.price ?? o.tier?.price ?? 0), 0) +
    payments
      .filter((p) => p.status === 'succeeded' && inRange(docTimeMs(p), pFrom, pTo))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  const prevReviews = (reviews as any[]).filter((r) => inRange(toMillis(r.created_at), pFrom, pTo));
  const prevRating = prevReviews.length
    ? prevReviews.reduce((s, r) => s + Number(r.rating || 0), 0) / prevReviews.length
    : 0;
  const deltas: AnalyticsDeltas = {
    bookings: pctChange(totalBookings, prevBookings),
    revenue: pctChange(totalRevenue, prevRevenue),
    rating: prevRating > 0 ? pctChange(avgRating, prevRating) : undefined,
  };

  // ── Revenue trend (trailing 6 months) ────────────────────────────────────
  const now = new Date();
  const months: { key: string; label: string; start: number; end: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()], start, end });
  }
  const revenueData = months.map((m) => {
    const oRev = gigOrders
      .filter((o) => isPaidOrder(o) && inRange(docTimeMs(o), m.start, m.end))
      .reduce((s, o) => s + Number(o.price ?? o.tier?.price ?? 0), 0);
    const pRev = payments
      .filter((p) => p.status === 'succeeded' && inRange(docTimeMs(p), m.start, m.end))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return { date: m.label, revenue: Math.round((oRev + pRev) * 100) / 100 };
  });

  // ── Peak booking times (weekday distribution within range) ────────────────
  const weekdayCounts = new Array(7).fill(0);
  [...ordersInRange, ...apptsInRange].forEach((rec) => {
    const ms = docTimeMs(rec);
    if (ms != null) weekdayCounts[new Date(ms).getDay()] += 1;
  });
  // Present Mon→Sun like the original chart.
  const bookingsData = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    time: WEEKDAYS[dow],
    bookings: weekdayCounts[dow],
  }));

  // ── Most popular services (within range) ──────────────────────────────────
  const serviceCounts = new Map<string, number>();
  ordersInRange.forEach((o) => {
    const name = o.gig_title || o.tier?.name || 'Other';
    serviceCounts.set(name, (serviceCounts.get(name) || 0) + 1);
  });
  if (serviceCounts.size === 0) {
    apptsInRange.forEach((a) => {
      const name = a.service_type || a.service || a.title || 'Consultation';
      serviceCounts.set(name, (serviceCounts.get(name) || 0) + 1);
    });
  }
  const servicesData = [...serviceCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Average review rating over time (trailing 6 months) ───────────────────
  const ratingsData = months.map((m) => {
    const monthReviews = (reviews as any[]).filter((r) => inRange(toMillis(r.created_at), m.start, m.end));
    const avg = monthReviews.length
      ? monthReviews.reduce((s, r) => s + Number(r.rating || 0), 0) / monthReviews.length
      : 0;
    return { month: m.label, rating: Math.round(avg * 10) / 10 };
  });

  return {
    metrics: {
      totalBookings,
      totalRevenue,
      avgRating: Math.round(avgRating * 10) / 10,
      retentionRate,
      profileViews,
      conversionRate,
    },
    deltas,
    revenueData,
    bookingsData,
    servicesData,
    ratingsData,
  };
}
