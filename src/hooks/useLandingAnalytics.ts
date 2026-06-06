import { useEffect, useRef } from 'react';
import {
  trackPageView,
  trackScrollDepth,
  trackTimeOnPage,
} from '@/services/landingAnalyticsService';

/**
 * Tracks:
 *  - page_view (once on mount)
 *  - scroll_depth at 25/50/75/100 milestones (each fires once per page load)
 *  - time_on_page on unmount / before unload
 */
export const useLandingAnalytics = (page: string, variant?: string) => {
  const startTime = useRef<number>(Date.now());
  const milestonesHit = useRef<Set<number>>(new Set());
  const sentTime = useRef<boolean>(false);

  useEffect(() => {
    // Fire page view
    trackPageView(page, variant);
    startTime.current = Date.now();

    const handleScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const percent = Math.round((scrollTop / max) * 100);
      [25, 50, 75, 100].forEach((m) => {
        if (percent >= m && !milestonesHit.current.has(m)) {
          milestonesHit.current.add(m);
          trackScrollDepth(page, m);
        }
      });
    };

    const sendTime = () => {
      if (sentTime.current) return;
      sentTime.current = true;
      const seconds = Math.round((Date.now() - startTime.current) / 1000);
      if (seconds > 0 && seconds < 60 * 60) {
        trackTimeOnPage(page, seconds);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') sendTime();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', sendTime);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', sendTime);
      document.removeEventListener('visibilitychange', handleVisibility);
      sendTime();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
};
