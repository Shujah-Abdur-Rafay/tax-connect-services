import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  UserPlus,
  Trash2,
  CheckCircle2,
  Link2,
  RefreshCw,
  BarChart3,
  DollarSign,
  FileText,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getNetworkForOwner,
  invitePreparer,
  removeMember,
  activateMember,
  type NetworkMember,
} from '@/services/preparerNetworkService';
import { fetchOrdersForPro, type GigOrderRecord } from '@/services/gigOrdersService';
import { fetchPlatformFeePercent } from '@/services/platformSettingsService';

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(n) ? n : 0,
  );

const STATUS_STYLE: Record<string, string> = {
  invited: 'bg-amber-100 text-amber-700 border-amber-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  removed: 'bg-slate-100 text-slate-500 border-slate-200',
};

interface MemberProduction {
  uid: string;
  label: string;
  gross: number;
  net: number;
  orders: number;
}

/**
 * Phase 4 — Service Bureau Partner control panel: preparer-network management
 * (invite / link / remove sub-preparers) plus advanced cross-network reporting
 * (gig-order production aggregated across the owner + linked preparers).
 */
const ServiceBureauPanel: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<NetworkMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);

  // Reporting
  const [production, setProduction] = useState<MemberProduction[]>([]);
  const [feePercent, setFeePercent] = useState(20);
  const [reportLoading, setReportLoading] = useState(false);

  const loadNetwork = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      setMembers(await getNetworkForOwner(user.uid));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Build the report whenever the linked roster changes.
  const linkedUids = useMemo(
    () => members.filter((m) => m.preparer_uid && m.status !== 'removed').map((m) => m.preparer_uid as string),
    [members],
  );

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      setReportLoading(true);
      try {
        const fee = await fetchPlatformFeePercent().catch(() => 20);
        if (!cancelled && Number.isFinite(fee)) setFeePercent(fee);

        // Owner + each linked preparer uid (dedup).
        const uids = Array.from(new Set([user.uid, ...linkedUids]));
        const rows: MemberProduction[] = [];
        for (const uid of uids) {
          let orders: GigOrderRecord[] = [];
          try {
            orders = await fetchOrdersForPro(uid);
          } catch {
            orders = [];
          }
          const paid = orders.filter((o) => o.payment_status === 'paid');
          const gross = paid.reduce((s, o) => s + Number(o.price || 0), 0);
          const label =
            uid === user.uid
              ? `${user.name} (you)`
              : members.find((m) => m.preparer_uid === uid)?.preparer_name ||
                members.find((m) => m.preparer_uid === uid)?.preparer_email ||
                'Preparer';
          rows.push({
            uid,
            label,
            gross,
            net: gross * (1 - (Number.isFinite(fee) ? fee : 20) / 100),
            orders: paid.length,
          });
        }
        if (!cancelled) setProduction(rows);
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, linkedUids.join(',')]);

  const totals = useMemo(() => {
    const gross = production.reduce((s, p) => s + p.gross, 0);
    const net = production.reduce((s, p) => s + p.net, 0);
    const orders = production.reduce((s, p) => s + p.orders, 0);
    return { gross, net, orders };
  }, [production]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || inviting) return;
    setInviting(true);
    try {
      await invitePreparer({
        ownerId: user.uid,
        ownerName: user.name,
        email: inviteEmail,
        name: inviteName || undefined,
      });
      setInviteEmail('');
      setInviteName('');
      toast({ title: 'Preparer invited', description: 'Added to your network roster.' });
      await loadNetwork();
    } catch (err: any) {
      toast({ title: 'Could not invite', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (m: NetworkMember) => {
    if (!confirm(`Remove ${m.preparer_name || m.preparer_email} from your network?`)) return;
    try {
      await removeMember(m.id);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err: any) {
      toast({ title: 'Could not remove', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleLinkUid = async (m: NetworkMember) => {
    const uid = prompt(
      `Link a platform account to ${m.preparer_name || m.preparer_email}.\nEnter their Firebase UID (found on their profile / from admin):`,
      m.preparer_uid || '',
    );
    if (uid === null) return;
    try {
      await activateMember(m.id, uid.trim() || undefined);
      toast({ title: 'Updated', description: 'Roster entry linked & activated.' });
      await loadNetwork();
    } catch (err: any) {
      toast({ title: 'Could not update', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Reporting */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          Network reporting
        </h2>
        <p className="text-sm text-slate-600">
          Gig-order production across you and your linked preparers (paid orders, at {feePercent}% platform fee).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ReportTile icon={<DollarSign className="h-5 w-5 text-emerald-600" />} label="Network net" value={currency(totals.net)} />
        <ReportTile icon={<DollarSign className="h-5 w-5 text-slate-600" />} label="Network gross" value={currency(totals.gross)} />
        <ReportTile icon={<FileText className="h-5 w-5 text-indigo-600" />} label="Paid orders" value={String(totals.orders)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Production by preparer</CardTitle>
          <CardDescription>Link a preparer's account below to include their orders here.</CardDescription>
        </CardHeader>
        <CardContent>
          {reportLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="divide-y divide-slate-100">
              {production.map((p) => (
                <div key={p.uid} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.orders} paid order{p.orders === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-emerald-700">{currency(p.net)}</div>
                    <div className="text-xs text-slate-400">of {currency(p.gross)} gross</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network management */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Users className="h-5 w-5 text-blue-600" />
          Preparer network
        </h2>
        <Button variant="outline" size="sm" onClick={loadNetwork}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a preparer</CardTitle>
          <CardDescription>Add a sub-preparer to your office by email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="inv-email">Email *</Label>
              <Input
                id="inv-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="preparer@example.com"
                className="mt-1.5"
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Preparer"
                className="mt-1.5"
              />
            </div>
            <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Roster <span className="text-sm font-normal text-slate-400">({members.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No preparers yet. Invite your first one above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-900">
                        {m.preparer_name || m.preparer_email}
                      </span>
                      <Badge variant="outline" className={STATUS_STYLE[m.status]}>
                        {m.status}
                      </Badge>
                      {m.preparer_uid && (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Link2 className="h-3 w-3" />
                          linked
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{m.preparer_email}</div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleLinkUid(m)} title="Link account / activate">
                      {m.status === 'active' ? (
                        <Link2 className="h-4 w-4 text-slate-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(m)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ReportTile: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-50">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
    </CardContent>
  </Card>
);

export default ServiceBureauPanel;
