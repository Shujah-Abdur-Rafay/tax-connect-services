import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Clock,
  Percent,
  Banknote,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  fetchOrdersForPro,
  ORDER_STATUS_META,
  type GigOrderRecord,
} from '@/services/gigOrdersService';
import { fetchPlatformFeePercent } from '@/services/platformSettingsService';

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

interface ProEarningsSummaryProps {
  professionalId: string;
}

/**
 * Phase 3 — Earnings & Commissions view for the consolidated pro dashboard.
 *
 * Computes lifetime/period earnings client-side from the pro's gig orders and
 * applies the live platform commission split (platform_settings/fees, default
 * 20%) so the pro sees gross, the platform's cut, and their net take-home. For
 * the authoritative bank balance and payout schedule it links to the Stripe
 * Connect payouts page (/pro-payouts), which reads live from Stripe.
 */
const ProEarningsSummary: React.FC<ProEarningsSummaryProps> = ({ professionalId }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<GigOrderRecord[]>([]);
  const [feePercent, setFeePercent] = useState<number>(20);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ords, fee] = await Promise.all([
          fetchOrdersForPro(professionalId),
          fetchPlatformFeePercent().catch(() => 20),
        ]);
        if (cancelled) return;
        setOrders(ords);
        if (typeof fee === 'number' && Number.isFinite(fee)) setFeePercent(fee);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId]);

  const stats = useMemo(() => {
    // A paid order contributes to earnings; refunded ones are backed out.
    const paid = orders.filter((o) => o.payment_status === 'paid');
    const refunded = orders.filter((o) => o.payment_status === 'refunded');

    const gross = paid.reduce((sum, o) => sum + Number(o.price || 0), 0);
    const commission = gross * (feePercent / 100);
    const net = gross - commission;

    // Pending = accepted, awaiting client payment (money not yet collected).
    const pending = orders
      .filter((o) => o.status === 'awaiting_payment')
      .reduce((sum, o) => sum + Number(o.price || 0), 0);

    const refundedTotal = refunded.reduce(
      (sum, o) => sum + Number(o.refund_amount ?? o.price ?? 0),
      0,
    );

    const completed = orders.filter((o) => o.status === 'completed').length;

    return {
      gross,
      commission,
      net,
      pending,
      refundedTotal,
      paidCount: paid.length,
      completed,
      refundedCount: refunded.length,
    };
  }, [orders, feePercent]);

  const recent = useMemo(
    () => orders.filter((o) => o.payment_status === 'paid' || o.payment_status === 'refunded').slice(0, 6),
    [orders],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-56" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Earnings &amp; Commissions
          </h2>
          <p className="text-sm text-slate-600">
            Calculated from your paid gig orders at the current {feePercent}% platform fee.
          </p>
        </div>
        <Button onClick={() => navigate('/pro-payouts')} className="bg-violet-600 hover:bg-violet-700">
          <Banknote className="mr-2 h-4 w-4" />
          Stripe payouts
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Net earnings"
          value={currency(stats.net)}
          sub={`After ${feePercent}% platform fee`}
        />
        <StatTile
          icon={<Wallet className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-100"
          label="Gross collected"
          value={currency(stats.gross)}
          sub={`${stats.paidCount} paid order${stats.paidCount === 1 ? '' : 's'}`}
        />
        <StatTile
          icon={<Percent className="h-5 w-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
          label="Platform commission"
          value={currency(stats.commission)}
          sub={`${feePercent}% of gross`}
        />
        <StatTile
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
          label="Pending payment"
          value={currency(stats.pending)}
          sub="Awaiting client checkout"
        />
      </div>

      {stats.refundedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <RotateCcw className="h-4 w-4 text-slate-400" />
          {stats.refundedCount} refunded order{stats.refundedCount === 1 ? '' : 's'} totalling{' '}
          <span className="font-medium text-slate-800">{currency(stats.refundedTotal)}</span> (not
          included in earnings above).
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Your latest paid and refunded gig orders.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No paid orders yet. Once a client pays for an order, your earnings show up here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((o) => {
                const refunded = o.payment_status === 'refunded';
                const meta = ORDER_STATUS_META[o.status];
                const proNet = Number(o.price || 0) * (1 - feePercent / 100);
                return (
                  <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {o.gig_title || 'Gig order'}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">{o.client_name || 'Client'}</span>
                        <span>·</span>
                        <span>{fmtDate(o.paid_at || o.created_at)}</span>
                        {meta && (
                          <Badge variant="outline" className={meta.color}>
                            {meta.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={
                          'font-semibold tabular-nums ' +
                          (refunded ? 'text-slate-400 line-through' : 'text-emerald-700')
                        }
                      >
                        {currency(refunded ? Number(o.refund_amount ?? o.price ?? 0) : proNet)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {refunded ? 'Refunded' : `of ${currency(Number(o.price || 0))}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatTile: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}> = ({ icon, iconBg, label, value, sub }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="mb-3 flex items-center justify-between">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${iconBg}`}>
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </CardContent>
  </Card>
);

export default ProEarningsSummary;
