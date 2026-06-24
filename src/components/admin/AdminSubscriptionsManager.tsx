import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, CreditCard, ExternalLink, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import {
  getSubscriptionProfessionals,
  type AdminSubscription,
} from '@/services/adminReportingService';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  trialing: 'bg-blue-100 text-blue-700 border-blue-200',
  past_due: 'bg-amber-100 text-amber-700 border-amber-200',
  unpaid: 'bg-amber-100 text-amber-700 border-amber-200',
  paused: 'bg-slate-100 text-slate-600 border-slate-200',
  canceled: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  active: CheckCircle2,
  trialing: CheckCircle2,
  past_due: AlertTriangle,
  unpaid: AlertTriangle,
  canceled: XCircle,
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
};

/**
 * Phase 5 — admin subscription monitoring. Lists professionals with a Stripe
 * subscription/customer footprint and their billing status (synced by the
 * customer.subscription.* webhook). Per-customer actions (cancel/refund) happen
 * in the linked Stripe dashboard.
 */
const AdminSubscriptionsManager: React.FC = () => {
  const [rows, setRows] = useState<AdminSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getSubscriptionProfessionals());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term),
    );
  }, [rows, search]);

  const counts = useMemo(() => {
    const active = rows.filter((r) => r.subscriptionStatus === 'active' || r.subscriptionStatus === 'trialing').length;
    const pastDue = rows.filter((r) => r.subscriptionStatus === 'past_due' || r.subscriptionStatus === 'unpaid').length;
    const canceled = rows.filter((r) => r.subscriptionStatus === 'canceled').length;
    return { active, pastDue, canceled };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            Subscriptions
          </h2>
          <p className="text-sm text-slate-500">
            {rows.length} member{rows.length === 1 ? '' : 's'} · {counts.active} active · {counts.pastDue} past due ·{' '}
            {counts.canceled} canceled
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            No subscriptions yet. They appear here once members subscribe via Stripe.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const status = r.subscriptionStatus || 'none';
            const StatusIcon = STATUS_ICON[status];
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link to={`/professional/${r.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                      {r.name}
                    </Link>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.membershipTier && (
                      <Badge variant="secondary" className="font-normal">
                        {r.membershipTier}
                      </Badge>
                    )}
                    <Badge variant="outline" className={STATUS_STYLE[status] || 'bg-slate-100 text-slate-600'}>
                      {StatusIcon && <StatusIcon className="mr-1 h-3 w-3" />}
                      {status}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {r.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {fmtDate(r.currentPeriodEnd)}
                    </span>
                    {r.stripeCustomerId && (
                      <a
                        href={`https://dashboard.stripe.com/customers/${r.stripeCustomerId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        Stripe
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptionsManager;
