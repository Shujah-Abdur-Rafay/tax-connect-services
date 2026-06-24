import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

export type LandingEventType =
  | 'page_view'
  | 'cta_click'
  | 'scroll_depth'
  | 'time_on_page'
  | 'tier_interest'
  | 'session_end';

export interface LandingEvent {
  id?: string;
  page: string;
  eventType: LandingEventType;
  // For CTA clicks: identifier of which CTA (e.g., "register_hero", "view_tiers", "calculate_earnings")
  ctaId?: string;
  // For scroll_depth events
  scrollPercent?: number;
  // For time_on_page events (seconds)
  durationSeconds?: number;
  // For tier_interest
  tier?: 'associate' | 'professional' | 'premier';
  // A/B variant if applicable
  variant?: string;
  // Session/visitor identifiers (anonymous)
  sessionId: string;
  visitorId: string;
  // Source / referrer
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  // Device
  userAgent?: string;
  screenWidth?: number;
  // Timestamp
  createdAt?: Timestamp;
}

const COLLECTION = 'landing_analytics';

// Visitor ID (persistent across sessions) stored in localStorage
const VISITOR_KEY = 'rc_landing_visitor_id';
const SESSION_KEY = 'rc_landing_session_id';
const SESSION_TIMEOUT_MIN = 30;
const SESSION_LAST_ACTIVE_KEY = 'rc_landing_session_last_active';

const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const getVisitorId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `v_${generateId()}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
};

export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  const now = Date.now();
  const lastActive = parseInt(
    sessionStorage.getItem(SESSION_LAST_ACTIVE_KEY) || '0',
    10
  );
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id || now - lastActive > SESSION_TIMEOUT_MIN * 60 * 1000) {
    id = `s_${generateId()}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
  return id;
};

const parseUtm = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
  };
};

const baseContext = () => {
  if (typeof window === 'undefined') return {};
  return {
    referrer: document.referrer || undefined,
    userAgent: navigator.userAgent,
    screenWidth: window.innerWidth,
    ...parseUtm(),
  };
};

export const trackLandingEvent = async (
  event: Omit<LandingEvent, 'sessionId' | 'visitorId' | 'createdAt'>
): Promise<void> => {
  try {
    const payload: Record<string, unknown> = {
      ...baseContext(),
      ...event,
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      createdAt: serverTimestamp(),
    };
    // Strip undefined values (Firestore doesn't accept them)
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k]
    );
    await addDoc(collection(db, COLLECTION), payload);
  } catch (err) {
    // Don't break the page if analytics fails
    console.warn('Landing analytics failed:', err);
  }
};

export const trackPageView = (page: string, variant?: string) =>
  trackLandingEvent({ page, eventType: 'page_view', variant });

export const trackCtaClick = (page: string, ctaId: string, variant?: string) =>
  trackLandingEvent({ page, eventType: 'cta_click', ctaId, variant });

export const trackScrollDepth = (page: string, scrollPercent: number) =>
  trackLandingEvent({ page, eventType: 'scroll_depth', scrollPercent });

export const trackTimeOnPage = (page: string, durationSeconds: number) =>
  trackLandingEvent({ page, eventType: 'time_on_page', durationSeconds });

export const trackTierInterest = (
  page: string,
  tier: 'associate' | 'professional' | 'premier'
) => trackLandingEvent({ page, eventType: 'tier_interest', tier });

// --- Aggregation helpers for the admin dashboard ---

export interface AggregatedAnalytics {
  totalEvents: number;
  pageViews: number;
  uniqueVisitors: number;
  uniqueSessions: number;
  ctaClicks: Record<string, number>;
  tierInterest: Record<string, number>;
  scrollBuckets: Record<string, number>; // "25", "50", "75", "100"
  avgTimeOnPage: number;
  conversionRate: number; // registerCTA / pageViews
  funnel: {
    viewed: number;
    scrolled50: number;
    viewedTiers: number;
    clickedRegister: number;
  };
  recentEvents: LandingEvent[];
}

export const fetchLandingAnalytics = async (
  page = '/join-platform',
  daysBack = 30
): Promise<AggregatedAnalytics> => {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const q = query(
    collection(db, COLLECTION),
    where('page', '==', page),
    where('createdAt', '>=', Timestamp.fromDate(since)),
    orderBy('createdAt', 'desc'),
    limit(5000)
  );

  let events: LandingEvent[] = [];
  try {
    const snapshot = await getDocs(q);
    events = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as LandingEvent) }));
  } catch (err) {
    // Fallback without composite filter if index missing
    console.warn('Falling back without filter:', err);
    const fallback = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(5000)
    );
    const snapshot = await getDocs(fallback);
    events = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as LandingEvent) }))
      .filter((e) => e.page === page);
  }

  const visitors = new Set<string>();
  const sessions = new Set<string>();
  const ctaClicks: Record<string, number> = {};
  const tierInterest: Record<string, number> = { associate: 0, professional: 0, premier: 0 };
  const scrollBuckets: Record<string, number> = { '25': 0, '50': 0, '75': 0, '100': 0 };
  let pageViews = 0;
  let timeTotal = 0;
  let timeCount = 0;
  const sessionsScrolled50 = new Set<string>();
  const sessionsViewedTiers = new Set<string>();
  const sessionsClickedRegister = new Set<string>();
  const sessionsViewed = new Set<string>();

  events.forEach((e) => {
    if (e.visitorId) visitors.add(e.visitorId);
    if (e.sessionId) sessions.add(e.sessionId);

    if (e.eventType === 'page_view') {
      pageViews += 1;
      if (e.sessionId) sessionsViewed.add(e.sessionId);
    }
    if (e.eventType === 'cta_click' && e.ctaId) {
      ctaClicks[e.ctaId] = (ctaClicks[e.ctaId] || 0) + 1;
      if (e.ctaId.startsWith('register') && e.sessionId) {
        sessionsClickedRegister.add(e.sessionId);
      }
      if (e.ctaId === 'view_tiers' && e.sessionId) {
        sessionsViewedTiers.add(e.sessionId);
      }
    }
    if (e.eventType === 'tier_interest' && e.tier) {
      tierInterest[e.tier] = (tierInterest[e.tier] || 0) + 1;
    }
    if (e.eventType === 'scroll_depth' && typeof e.scrollPercent === 'number') {
      const p = e.scrollPercent;
      if (p >= 100) scrollBuckets['100'] += 1;
      else if (p >= 75) scrollBuckets['75'] += 1;
      else if (p >= 50) scrollBuckets['50'] += 1;
      else if (p >= 25) scrollBuckets['25'] += 1;
      if (p >= 50 && e.sessionId) sessionsScrolled50.add(e.sessionId);
    }
    if (e.eventType === 'time_on_page' && typeof e.durationSeconds === 'number') {
      timeTotal += e.durationSeconds;
      timeCount += 1;
    }
  });

  const avgTimeOnPage = timeCount > 0 ? Math.round(timeTotal / timeCount) : 0;
  const totalRegisterClicks =
    (ctaClicks['register_hero'] || 0) +
    (ctaClicks['register_inline'] || 0) +
    (ctaClicks['register_footer'] || 0);
  const conversionRate =
    pageViews > 0 ? +((totalRegisterClicks / pageViews) * 100).toFixed(2) : 0;

  return {
    totalEvents: events.length,
    pageViews,
    uniqueVisitors: visitors.size,
    uniqueSessions: sessions.size,
    ctaClicks,
    tierInterest,
    scrollBuckets,
    avgTimeOnPage,
    conversionRate,
    funnel: {
      viewed: sessionsViewed.size,
      scrolled50: sessionsScrolled50.size,
      viewedTiers: sessionsViewedTiers.size,
      clickedRegister: sessionsClickedRegister.size,
    },
    recentEvents: events.slice(0, 50),
  };
};
