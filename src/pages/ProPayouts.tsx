import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchConnectDashboard,
  startConnectOnboarding,
  syncConnectAccountStatus,
  getProStripeAccount,
  formatStripeAmount,
  formatStripeDate,
  type StripeConnectDashboard,
} from '@/services/stripeConnectService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Banknote,
  ExternalLink,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Building2,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * /pro-payouts — Stripe Connect Express payout dashboard for pros.
 *
 * Three rendering states:
 *   1. Not signed in / not a pro       → friendly "sign in" CTA
 *   2. No connected Stripe account yet → "Connect bank account" onboarding card
 *   3. Connected                        → balance + payouts dashboard
 *
 * URL params we react to (set by Stripe when the hosted onboarding redirects):
 *   ?onboarded=1   → just finished onboarding → resync status from Stripe
 *   ?refresh=1     → onboarding link expired → offer to restart
 */
const ProPayouts = () => {
  const { user, loading: authLoading, isProfessional } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<StripeConnectDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const justOnboarded = searchParams.get('onboarded') === '1';
  const linkExpired = searchParams.get('refresh') === '1';

  // ── 1. Load the pro's stripe_account_id from Firestore on mount ─────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await getProStripeAccount(user.uid);
        if (cancelled) return;
        setAccountId(info.stripe_account_id);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load your Stripe account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // ── 2. Once we have an accountId, fetch live dashboard data ─────────
  useEffect(() => {
    if (!user || !accountId) return;
    let cancelled = false;
    (async () => {
      setRefreshing(true);
      setError(null);
      try {
        // If we just returned from onboarding, sync capability flags first
        // so the UI reflects the new state immediately.
        if (justOnboarded) {
          try {
            await syncConnectAccountStatus(user.uid, accountId);
          } catch (e) {
            console.warn('[ProPayouts] sync after onboarding failed', e);
          }
        }
        const data = await fetchConnectDashboard(accountId);
        if (cancelled) return;
        setDashboard(data);
        // Mirror the latest flags onto Firestore on every load — it's cheap
        // and keeps the rest of the app (checkout, admin) in sync.
        try {
          await syncConnectAccountStatus(user.uid, accountId);
        } catch (e) {
          console.warn('[ProPayouts] passive sync failed', e);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load Stripe dashboard.');
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, accountId, justOnboarded]);

  // Strip the success / refresh query params once we've acted on them.
  useEffect(() => {
    if (justOnboarded || linkExpired) {
      const next = new URLSearchParams(searchParams);
      next.delete('onboarded');
      next.delete('refresh');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartOnboarding = async () => {
    if (!user) return;
    setOnboardingLoading(true);
    setError(null);
    try {
      const { onboardingUrl, accountId: newId } = await startConnectOnboarding({
        proId: user.uid,
        email: user.email,
        name: user.name,
        existingAccountId: accountId,
      });
      setAccountId(newId);
      // Same-tab redirect into Stripe's hosted onboarding flow.
      window.location.href = onboardingUrl;
    } catch (e: any) {
      setError(e?.message || 'Could not start Stripe onboarding. Please try again.');
      toast({
        title: 'Stripe Connect unavailable',
        description: e?.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
      setOnboardingLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user || !accountId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await fetchConnectDashboard(accountId);
      setDashboard(data);
      await syncConnectAccountStatus(user.uid, accountId);
    } catch (e: any) {
      setError(e?.message || 'Could not refresh.');
    } finally {
      setRefreshing(false);
    }
  };

  // ── Render guards ──────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64 mt-6" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700 mb-4">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Sign in to manage payouts</h1>
          <p className="text-slate-600 mb-6">
            The payout dashboard is for tax professionals. Sign in to your pro account to
            connect a bank and see your Stripe balance.
          </p>
          <Button onClick={() => navigate('/')} className="bg-violet-600 hover:bg-violet-700">
            Go to homepage
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isProfessional) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold mb-2">For tax professionals only</h1>
          <p className="text-slate-600 mb-6">
            Payouts are configured per-pro. If you're a tax pro and this is your account,
            update your role from your profile and try again.
          </p>
          <Button onClick={() => navigate('/profile')} variant="outline">
            Go to your profile
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Empty / onboarding state ───────────────────────────────────────
  if (!accountId || !dashboard?.account?.detailsSubmitted) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
            <p className="text-slate-600 mt-1">
              Connect a bank account through Stripe to receive payments from your gig orders.
            </p>
          </div>

          {linkExpired && (
            <Alert className="mb-6 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertTitle>Onboarding link expired</AlertTitle>
              <AlertDescription>
                The previous link timed out. Click "Connect bank account" below to resume —
                Stripe will pick up where you left off.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Stripe Connect error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="border-violet-100">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Connect your bank account</CardTitle>
                  <CardDescription>
                    Powered by Stripe Connect Express • Takes about 5 minutes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <FeaturePoint
                  icon={<ShieldCheck className="h-5 w-5 text-violet-600" />}
                  title="Bank-level security"
                  description="Stripe verifies your identity and protects your account info — we never see it."
                />
                <FeaturePoint
                  icon={<Banknote className="h-5 w-5 text-violet-600" />}
                  title="Automatic payouts"
                  description="Funds from each paid order route to your bank on Stripe's standard schedule (~2 days)."
                />
                <FeaturePoint
                  icon={<ArrowUpRight className="h-5 w-5 text-violet-600" />}
                  title="Stripe Express dashboard"
                  description="Manage tax forms, payout speed, and bank details right from Stripe."
                />
              </div>

              <Separator />

              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 flex gap-3">
                <Info className="h-5 w-5 flex-shrink-0 text-slate-500 mt-0.5" />
                <p>
                  You'll need: a government-issued ID, your SSN (US) or business EIN, and the
                  bank account where you want payouts to land. Stripe collects this directly —
                  Refund Connect never stores it.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleStartOnboarding}
                  disabled={onboardingLoading}
                  className="bg-[#635BFF] hover:bg-[#5147e0] text-white text-base h-12 px-6"
                >
                  {onboardingLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting to Stripe…
                    </>
                  ) : (
                    <>
                      {accountId ? 'Resume Stripe onboarding' : 'Connect Stripe'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => navigate('/pro/orders')} className="h-12">
                  Back to orders
                </Button>
              </div>

            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Connected dashboard state ──────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
            <p className="text-slate-600 mt-1">
              Real-time balance and recent payouts from your Stripe Connect account.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {dashboard.expressLoginUrl && (
              <Button asChild className="bg-slate-900 hover:bg-slate-800">
                <a
                  href={dashboard.expressLoginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  Open Stripe dashboard
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {justOnboarded && dashboard.account.chargesEnabled && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertTitle>Bank account connected</AlertTitle>
            <AlertDescription>
              Stripe approved your account. New gig payments will route to your bank automatically.
            </AlertDescription>
          </Alert>
        )}

        <AccountStatusBanner summary={dashboard.account} onResumeOnboarding={handleStartOnboarding} />

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Balance tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <BalanceTile
            icon={<Wallet className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Available"
            amount={dashboard.balance.availableCents}
            currency={dashboard.balance.currency}
            sublabel="Ready to pay out to your bank"
          />
          <BalanceTile
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-50"
            label="Pending"
            amount={dashboard.balance.pendingCents}
            currency={dashboard.balance.currency}
            sublabel="Clearing — typically 2 business days"
          />
          <BalanceTile
            icon={<ShieldCheck className="h-5 w-5 text-slate-600" />}
            iconBg="bg-slate-50"
            label="Reserved"
            amount={dashboard.balance.reservedCents}
            currency={dashboard.balance.currency}
            sublabel="Held by Stripe for risk / disputes"
          />
        </div>

        {/* Recent payouts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent payouts</CardTitle>
                <CardDescription>
                  The last 10 transfers Stripe has sent to your bank account.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-slate-300">
                {dashboard.payouts.length} payout{dashboard.payouts.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PayoutsList
              payouts={dashboard.payouts}
              currency={dashboard.balance.currency}
            />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────

const FeaturePoint = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <div className="flex flex-col gap-2 p-4 rounded-lg border border-slate-200 bg-white">
    <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-violet-50">
      {icon}
    </div>
    <h3 className="font-semibold text-slate-900">{title}</h3>
    <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
  </div>
);

const BalanceTile = ({
  icon,
  iconBg,
  label,
  amount,
  currency,
  sublabel,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  amount: number;
  currency: string;
  sublabel: string;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${iconBg}`}>
          {icon}
        </span>
        <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
        {formatStripeAmount(amount, currency)}
      </div>
      <p className="text-xs text-slate-500 mt-1">{sublabel}</p>
    </CardContent>
  </Card>
);

const AccountStatusBanner = ({
  summary,
  onResumeOnboarding,
}: {
  summary: StripeConnectDashboard['account'];
  onResumeOnboarding: () => void;
}) => {
  const fullyEnabled = summary.chargesEnabled && summary.payoutsEnabled;
  const needsMoreInfo =
    summary.requirements.currentlyDue.length > 0 ||
    summary.requirements.pastDue.length > 0;

  if (fullyEnabled && !needsMoreInfo) {
    return (
      <Alert className="mb-6 border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-700" />
        <AlertTitle>Account fully enabled</AlertTitle>
        <AlertDescription className="text-green-900">
          Charges and payouts are both active. Funds from new orders will route to your bank
          automatically.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50">
      <AlertTriangle className="h-4 w-4 text-amber-700" />
      <AlertTitle>
        {needsMoreInfo ? 'Stripe needs more info' : 'Onboarding incomplete'}
      </AlertTitle>
      <AlertDescription className="text-amber-900 space-y-2">
        <p>
          {!summary.chargesEnabled && 'Charges aren\'t enabled yet — payments to you can\'t route through your account. '}
          {!summary.payoutsEnabled && summary.chargesEnabled && 'Payouts to your bank aren\'t enabled yet. '}
          {needsMoreInfo &&
            `${summary.requirements.currentlyDue.length + summary.requirements.pastDue.length} item(s) need attention in Stripe.`}
        </p>
        <Button
          size="sm"
          onClick={onResumeOnboarding}
          className="bg-amber-700 hover:bg-amber-800 text-white"
        >
          Finish in Stripe
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </AlertDescription>
    </Alert>
  );
};

const PayoutsList = ({
  payouts,
  currency,
}: {
  payouts: StripeConnectDashboard['payouts'];
  currency: string;
}) => {
  if (payouts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
          <Banknote className="h-6 w-6" />
        </div>
        <h3 className="font-semibold text-slate-900 mb-1">No payouts yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Once a client pays for an order and the funds clear, your first payout will land in
          your bank account on Stripe's standard schedule (typically 2 business days).
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {payouts.map((p) => (
        <PayoutRow key={p.id} payout={p} currency={currency} />
      ))}
    </div>
  );
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700 border-green-200' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  in_transit: { label: 'In transit', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  canceled: { label: 'Canceled', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
};

const PayoutRow = ({
  payout,
  currency,
}: {
  payout: StripeConnectDashboard['payouts'][number];
  currency: string;
}) => {
  const style = STATUS_STYLES[payout.status] || {
    label: payout.status,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <div className="py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 inline-flex items-center justify-center flex-shrink-0">
          <Banknote className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatStripeAmount(payout.amount, payout.currency || currency)}
            </span>
            <Badge variant="outline" className={style.className}>
              {style.label}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            Arrives {formatStripeDate(payout.arrivalDate)}
            {payout.method ? ` • ${payout.method === 'instant' ? 'Instant' : 'Standard'}` : ''}
            {payout.statementDescriptor ? ` • ${payout.statementDescriptor}` : ''}
          </div>
          {payout.failureMessage && (
            <div className="text-xs text-red-600 mt-1">⚠ {payout.failureMessage}</div>
          )}
        </div>
      </div>
      <div className="text-xs text-slate-400 hidden sm:block">
        Initiated {formatStripeDate(payout.created)}
      </div>
    </div>
  );
};

export default ProPayouts;
