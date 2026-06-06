import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePendingReferralCode } from '@/services/referralService';

/**
 * Global router-aware effect: any time the URL contains `?ref=CODE`, persist
 * the code to localStorage so it can be applied on the visitor's eventual
 * signup. Renders nothing.
 *
 * Mounted once inside BrowserRouter so it fires on every navigation —
 * including initial page load and SPA route changes.
 */
const ReferralCapture: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      capturePendingReferralCode(ref);
    }
  }, [location.search]);

  return null;
};

export default ReferralCapture;
