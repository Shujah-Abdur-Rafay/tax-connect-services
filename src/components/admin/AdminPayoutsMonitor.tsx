import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  Percent,
  Wallet,
  RotateCcw,
  RefreshCw,
  Settings,
  TrendingUp,
} from 'lucide-react';
import {
  getAllGigOrdersForAdmin,
  buildCommissionReport,
  type AdminGigOrder,
} from '@/services/adminReportingService';
import { fetchPlatformFeePercent } from '@/services/platformSettingsService';

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(n) ? n : 0,
  );

/**
 * Phase 5 — admin payout & commission monitoring. Aggregates the platform's
 * cut (and the pros' net) across every paid gig order at the live platform fee,
 * with a per-pro breakdown. For live bank balances/transfers each pro uses
 * their own Stripe Connect dashboard; this is the platform-side revenue view.
 */
const AdminPayoutsMonitor: React.FC = () => {
  const [orders, setOrders] = useState<AdminGigOrder[]>([]);
  const [feePercent, setFeePercent] = useState(20);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [ords, fee] = await Promise.all([
        getAllGigOrdersForAdmin(),
        fetchPlatformFeePercent().catch(() => 20),
      ]);
      setOrders(ords);
      if (Number.isFinite(fee)) setFeePercent(fee);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const report = useMemo(() => buildCommissionReport(orders, feePercent), [orders, feePercent]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Payouts &amp; commissions
          </h2>
          <p className="text-sm text-slate-500">
            Across {report.paidOrders} paid order{report.paidOrders === 1 ? '' : 's'} at the current{' '}
            {feePercent}% platform fee.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/platform-fees">
              <Settings className="mr-2 h-4 w-4" />
              Adjust fee
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={<Percent className="h-5 w-5 text-indigo-600" />} bg="bg-indigo-50" label="Platform commission" value={currency(report.platformCommission)} sub={`${feePercent}% of gross`} />
        <Tile icon={<Wallet className="h-5 w-5 text-slate-600" />} bg="bg-slate-100" label="Gross volume" value={currency(report.gross)} sub="All paid orders" />
        <Tile icon={<DollarSign className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-50" label="Paid to pros" value={currency(report.proNet)} sub="Net after commission" />
        <Tile icon={<RotateCcw className="h-5 w-5 text-amber-600" />} bg="bg-amber-50" label="Refunded" value={currency(report.refundedTotal)} sub={`${report.refundedOrders} order(s)`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commission by professional</CardTitle>
          <CardDescription>Platform cut earned from each pro's paid orders.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.byPro.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No paid orders yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.byPro.map((p) => (
                <div key={p.proId} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/professional/${p.proId}`}
                      className="truncate font-medium text-slate-900 hover:text-blue-600"
                    >
                      {p.proName}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p.orders} paid order{p.orders === 1 ? '' : 's'} · {currency(p.gross)} gross
                    </div>
                  </div>
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                    {currency(p.commission)} commission
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Tile: React.FC<{ icon: React.ReactNode; bg: string; label: string; value: string; sub: string }> = ({
  icon,
  bg,
  label,
  value,
  sub,
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${bg}`}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </CardContent>
  </Card>
);

export default AdminPayoutsMonitor;
