import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CreditCard, CheckCircle2, RotateCw, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  SUBSCRIPTION_TIERS,
  redirectToSubscriptionCheckout,
  openBillingPortal,
} from '@/services/subscriptionService';
import type { MembershipTier } from '@/services/membershipCheckoutService';
import { getPtinStatus } from '@/services/ptinService';
import PtinVerificationDialog from '@/components/pro/PtinVerificationDialog';

interface SubStatus {
  subscriptionStatus?: string | null;
  membershipTier?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  hasCustomer: boolean;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  trialing: 'bg-blue-100 text-blue-700 border-blue-200',
  past_due: 'bg-amber-100 text-amber-700 border-amber-200',
  canceled: 'bg-slate-100 text-slate-600 border-slate-200',
};

/**
 * Phase 4 — recurring membership billing panel.
 *
 * If the pro already has a Stripe subscription, shows its status + a "Manage
 * billing" button into the Stripe Customer Portal. Otherwise lists the
 * subscribe-able tiers; each Subscribe button enforces the PTIN gate before
 * sending the pro to Stripe Checkout (subscription mode).
 */
const SubscriptionBilling: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<MembershipTier | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [hasPtin, setHasPtin] = useState(false);
  const [ptinOpen, setPtinOpen] = useState(false);
  const [pendingTier, setPendingTier] = useState<MembershipTier | null>(null);

  const load = async () => {
    if (!db || !user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [snap, ptin] = await Promise.all([
        getDoc(doc(db, 'professionals', user.uid)),
        getPtinStatus(user.uid),
      ]);
      setHasPtin(ptin.hasPtin);
      const data = snap.exists() ? (snap.data() as Record<string, any>) : {};
      const cpe = data.currentPeriodEnd?.toDate
        ? data.currentPeriodEnd.toDate().toISOString()
        : data.currentPeriodEnd || null;
      setStatus({
        subscriptionStatus: data.subscriptionStatus || null,
        membershipTier: data.membershipTier || null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
        currentPeriodEnd: cpe,
        hasCustomer: !!data.stripeCustomerId,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const beginSubscribe = (tier: MembershipTier, requiresPtin: boolean) => {
    if (requiresPtin && !hasPtin) {
      setPendingTier(tier);
      setPtinOpen(true);
      return;
    }
    void doSubscribe(tier);
  };

  const doSubscribe = async (tier: MembershipTier) => {
    if (!user?.uid) return;
    setBusyTier(tier);
    try {
      const result = await redirectToSubscriptionCheckout({
        tier,
        professionalId: user.uid,
        email: user.email,
        name: user.name,
      });
      if (!result.ok) {
        toast({
          title: 'Could not start subscription',
          description:
            result.code === 'PRICE_NOT_CONFIGURED'
              ? 'Recurring pricing for this tier is not set up yet. Please contact support.'
              : result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
      // On success the browser is already redirecting to Stripe.
    } finally {
      setBusyTier(null);
    }
  };

  const handlePortal = async () => {
    if (!user?.uid) return;
    setPortalBusy(true);
    try {
      const result = await openBillingPortal({ professionalId: user.uid });
      if (result.ok && result.url) {
        window.location.href = result.url;
      } else {
        toast({
          title: 'Could not open billing',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setPortalBusy(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const active =
    status?.subscriptionStatus &&
    ['active', 'trialing', 'past_due'].includes(status.subscriptionStatus);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-600" />
                Membership billing
              </CardTitle>
              <CardDescription>
                {active
                  ? 'Your membership renews automatically. Manage it anytime in the Stripe portal.'
                  : 'Put your membership on auto-renew so your listing never lapses.'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {active ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Badge
                  variant="outline"
                  className={STATUS_STYLE[status!.subscriptionStatus!] || 'bg-slate-100 text-slate-600'}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {status!.subscriptionStatus}
                </Badge>
                {status?.membershipTier && (
                  <span className="text-sm font-medium text-slate-800">{status.membershipTier}</span>
                )}
                {status?.currentPeriodEnd && (
                  <span className="text-sm text-slate-500">
                    {status.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {fmtDate(status.currentPeriodEnd)}
                  </span>
                )}
              </div>
              <Button onClick={handlePortal} disabled={portalBusy}>
                {portalBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening…
                  </>
                ) : (
                  <>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Manage billing
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {SUBSCRIPTION_TIERS.map((t) => (
                  <div
                    key={t.tier}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      <div className="text-sm text-slate-500">
                        ${t.priceYearly.toFixed(2)}/yr · auto-renew
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={busyTier === t.tier}
                      onClick={() => beginSubscribe(t.tier, t.requiresPtin)}
                    >
                      {busyTier === t.tier ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Subscribe'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                {hasPtin
                  ? 'PTIN on file — you can subscribe to any tier.'
                  : 'A verified PTIN is required before subscribing to a paid tier.'}
              </p>
              {status?.hasCustomer && (
                <Button variant="outline" size="sm" onClick={handlePortal} disabled={portalBusy}>
                  {portalBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Manage existing billing
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PtinVerificationDialog
        open={ptinOpen}
        onOpenChange={setPtinOpen}
        uid={user.uid}
        onVerified={() => {
          setHasPtin(true);
          const tier = pendingTier;
          setPendingTier(null);
          if (tier) void doSubscribe(tier);
        }}
      />
    </>
  );
};

export default SubscriptionBilling;
