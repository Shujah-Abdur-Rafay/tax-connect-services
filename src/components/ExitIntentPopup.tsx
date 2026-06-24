import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Clock, Gift, CheckCircle2, Loader2, ShieldCheck, Copy, Check } from 'lucide-react';

import { submitExitIntentLead } from '@/services/exitIntentLeadService';
import { trackCtaClick } from '@/services/landingAnalyticsService';

interface ExitIntentPopupProps {
  page: string;
  variant?: string;
  /** Storage key to remember dismissal/conversion so the popup doesn't keep firing. */
  storageKey?: string;
  /** Offer headline + sublabel. */
  offerHeadline?: string;
  offerSubtext?: string;
  /** Countdown duration in seconds (default 15 min). */
  countdownSeconds?: number;
  /** How many ms a visitor must be on the page before the popup is allowed to fire. */
  minTimeOnPageMs?: number;
}

const DEFAULT_STORAGE_KEY = 'rc_exit_intent_shown_v1';

const ExitIntentPopup: React.FC<ExitIntentPopupProps> = ({
  page,
  variant,
  storageKey = DEFAULT_STORAGE_KEY,
  offerHeadline = 'Get $50 OFF Any Tier Upgrade',
  offerSubtext = 'Today only — claim your exclusive discount before it expires.',
  countdownSeconds = 15 * 60,
  minTimeOnPageMs = 5000,
}) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoExpiresAt, setPromoExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);


  const armedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  // Initialize: only arm if not already shown in this browser
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const shown = localStorage.getItem(storageKey);
      if (!shown) {
        armedRef.current = true;
      }
    } catch {
      armedRef.current = true;
    }
  }, [storageKey]);

  const trigger = useCallback(() => {
    if (!armedRef.current) return;
    if (Date.now() - mountTimeRef.current < minTimeOnPageMs) return;
    armedRef.current = false;
    setOpen(true);
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // ignore
    }
    // Track that exit intent fired
    trackCtaClick(page, 'exit_intent_shown', variant);
  }, [storageKey, minTimeOnPageMs, page, variant]);

  // Desktop: mouse leaving top of viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger when leaving from the top edge (toward close/tab buttons)
      if (e.clientY <= 0 && (e.relatedTarget === null || e.relatedTarget === undefined)) {
        trigger();
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [trigger]);

  // Mobile fallback: trigger on back-button / pagehide or after a long inactive scroll-up
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) return;

    let lastY = window.scrollY;
    let lastScrollTime = Date.now();
    const handleScroll = () => {
      const y = window.scrollY;
      const now = Date.now();
      // Fast scroll up near top after being deep in the page = potential exit
      if (lastY - y > 60 && y < 200 && now - mountTimeRef.current > minTimeOnPageMs) {
        trigger();
      }
      lastY = y;
      lastScrollTime = now;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [trigger, minTimeOnPageMs]);

  // Countdown timer
  useEffect(() => {
    if (!open || success) return;
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [open, success, secondsLeft]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleClose = () => {
    setOpen(false);
    trackCtaClick(page, 'exit_intent_dismissed', variant);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = email.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!emailValid) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitExitIntentLead({
        email: trimmed,
        name: name.trim() || undefined,
        offer: offerHeadline,
        page,
        variant,
      });
      if (!result.crmOk && !result.firestoreOk) {
        setErrorMsg('Something went wrong. Please try again.');
      } else {
        if (result.promoCode) setPromoCode(result.promoCode);
        if (result.promoExpiresAt) setPromoExpiresAt(result.promoExpiresAt);
        setSuccess(true);
        trackCtaClick(page, 'exit_intent_converted', variant);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!promoCode) return;
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!open) return null;



  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close popup"
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-600 hover:text-gray-900 shadow"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header / Offer */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white px-6 sm:px-8 pt-8 pb-6 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-300/40 text-yellow-200 px-3 py-1 rounded-full text-xs font-semibold mb-3">
              <Gift className="h-3.5 w-3.5" />
              LIMITED-TIME OFFER
            </div>
            <h2
              id="exit-intent-title"
              className="text-2xl sm:text-3xl font-extrabold leading-tight"
            >
              Wait! Before You Go…
            </h2>
            <p className="text-yellow-300 text-xl sm:text-2xl font-bold mt-2">
              {offerHeadline}
            </p>
            <p className="text-blue-100 text-sm mt-2">{offerSubtext}</p>

            {/* Countdown */}
            {!success && (
              <div className="mt-4 inline-flex items-center gap-2 bg-black/30 border border-white/20 px-4 py-2 rounded-lg">
                <Clock className="h-4 w-4 text-yellow-300" />
                <span className="text-xs uppercase tracking-wider text-blue-100">
                  Offer expires in
                </span>
                <span className="font-mono text-lg font-bold text-white tabular-nums">
                  {formatTime(secondsLeft)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 sm:px-8 py-6">
          {success ? (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-3">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                You're in! Check your inbox.
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                We sent your <strong>$50 OFF</strong> code to{' '}
                <strong>{email}</strong>.
              </p>

              {promoCode && (
                <div className="mb-4 border-2 border-dashed border-blue-400 bg-blue-50 rounded-lg p-4 text-left">
                  <div className="text-[11px] uppercase tracking-wider text-blue-700 font-semibold mb-1">
                    Your promo code
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <code className="font-mono text-lg sm:text-xl font-extrabold text-blue-900 tracking-wider break-all">
                      {promoCode}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
                      aria-label="Copy promo code"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  {promoExpiresAt && (
                    <div className="text-[11px] text-blue-700/80 mt-2 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Expires{' '}
                      {new Date(promoExpiresAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              )}

              <a
                href="/upgrade-membership"
                className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors w-full"
              >
                Apply My Discount Now
              </a>
              <button
                onClick={handleClose}
                className="block w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-3 underline-offset-2 hover:underline"
              >
                Continue Browsing
              </button>
            </div>

          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4 text-center">
                Enter your email and we'll send your <strong>$50 OFF</strong>{' '}
                code instantly — valid on Associate, Professional, or Premier
                tier upgrades.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="exit-name" className="sr-only">
                    Name
                  </label>
                  <input
                    id="exit-name"
                    type="text"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="exit-email" className="sr-only">
                    Email
                  </label>
                  <input
                    id="exit-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {errorMsg && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 px-6 py-3.5 rounded-lg font-bold text-base transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending your code…
                    </>
                  ) : (
                    <>
                      <Gift className="h-5 w-5" />
                      Claim My $50 OFF Code
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                No spam. Unsubscribe anytime.
              </div>

              <button
                onClick={handleClose}
                className="block w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-3 underline-offset-2 hover:underline"
              >
                No thanks, I'll pay full price
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExitIntentPopup;
