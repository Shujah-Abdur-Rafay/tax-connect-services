import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import OrderCard from '@/components/orders/OrderCard';
import {
  fetchOrdersForPro,
  updateOrderStatus,
  requestOrderPayment,
  refundGigOrder,
  type GigOrderRecord,
  type GigOrderStatus,
} from '@/services/gigOrdersService';
import {
  Inbox,
  Loader2,
  PackageOpen,
  Sparkles,
  DollarSign,
  Clock,
  ShieldCheck,
  Undo2,
} from 'lucide-react';


const TABS: { value: 'all' | GigOrderStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ProOrdersInbox: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<GigOrderRecord[]>([]);
  const [tab, setTab] = useState<'all' | GigOrderStatus>('all');

  const load = async (uid: string) => {
    setLoading(true);
    try {
      const list = await fetchOrdersForPro(uid);
      setOrders(list);
    } catch (e: any) {
      toast({
        title: 'Could not load orders',
        description: e?.message || 'Make sure your Firestore "gig_orders" collection is accessible.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/');
      return;
    }
    load(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  const handleUpdate = async (
    orderId: string,
    status: GigOrderStatus,
    extra?: { deliveryMessage?: string }
  ) => {
    if (!user) return;
    try {
      const updated = await updateOrderStatus(orderId, user.uid, status, extra);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      toast({ title: `Order ${status.replace('_', ' ')}` });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
  };

  const handleRequestPayment = async (orderId: string) => {
    if (!user) return;
    try {
      const updated = await requestOrderPayment(orderId, user.uid);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      toast({
        title: 'Payment request sent',
        description: `Stripe Checkout link ready for ${updated.client_email || 'the client'}. They'll see "Pay $${updated.price}" on their My Orders page.`,
      });
    } catch (e: any) {
      toast({
        title: 'Could not create Stripe checkout',
        description: e?.message || 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  };

  const handleRefund = async (orderId: string, reason: string) => {
    if (!user) return;
    try {
      const updated = await refundGigOrder(orderId, user.uid, { reason });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      toast({
        title: 'Refund issued',
        description: `$${updated.refund_amount ?? updated.price} returned to ${updated.client_name || 'the client'} via Stripe. The refund will appear on their card in 5–10 business days.`,
      });
    } catch (e: any) {
      toast({
        title: 'Refund failed',
        description: e?.message || 'Stripe rejected the refund request.',
        variant: 'destructive',
      });
    }
  };

  const filtered = useMemo(() => {
    if (tab === 'all') return orders;
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  const stats = useMemo(() => {
    // Paid revenue = sum of orders that are PAID and NOT refunded.
    // (payment_status === 'paid' already excludes 'refunded', but we keep the
    // intent explicit for future-proofing if we ever introduce partial-refund
    // statuses.)
    const totalRevenue = orders
      .filter((o) => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.price || 0), 0);
    const refundedCount = orders.filter((o) => o.payment_status === 'refunded').length;
    const refundedTotal = orders
      .filter((o) => o.payment_status === 'refunded')
      .reduce((sum, o) => sum + (o.refund_amount ?? o.price ?? 0), 0);
    return {
      total: orders.length,
      newCount: orders.filter((o) => o.status === 'new').length,
      awaitingPayment: orders.filter((o) => o.status === 'awaiting_payment').length,
      inProgress: orders.filter((o) => o.status === 'in_progress').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      revenue: totalRevenue,
      refundedCount,
      refundedTotal,
    };
  }, [orders]);


  return (
    <AppLayout>
      <section className="border-b bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-10">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <Inbox className="h-3 w-3" /> Orders Inbox
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">Incoming Orders</h1>
            <p className="mt-1 text-blue-100">
              Review briefs, accept work, get paid through Stripe, then deliver to your clients.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/pro/gigs')}
            className="bg-white text-slate-900 hover:bg-blue-50"
          >
            Manage gigs
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-7">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-blue-600">New</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{stats.newCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-orange-600">Awaiting pay</p>
            <p className="mt-1 text-2xl font-bold text-orange-700">{stats.awaitingPayment}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-amber-600">In progress</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{stats.inProgress}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-violet-600">Delivered</p>
            <p className="mt-1 text-2xl font-bold text-violet-700">{stats.delivered}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-green-600 flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Paid revenue
            </p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              ${stats.revenue.toLocaleString()}
            </p>
            {stats.refundedTotal > 0 && (
              <p className="mt-0.5 text-[10px] text-red-600">
                (net of ${stats.refundedTotal.toLocaleString()} refunded)
              </p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-red-600 flex items-center gap-1">
              <Undo2 className="h-3 w-3" /> Refunded
            </p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              ${stats.refundedTotal.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-red-500">
              {stats.refundedCount} order{stats.refundedCount === 1 ? '' : 's'}
            </p>
          </Card>
        </div>


        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold">Stripe-secured payments</p>
              <p className="mt-0.5 text-blue-800">
                Click <strong>Accept &amp; request payment</strong> on a new order to generate a Stripe Checkout
                link for the client. Work unlocks the moment payment clears — the Deliver button
                stays locked until then.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab}>
            {loading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading orders…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
                <PackageOpen className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <h3 className="text-lg font-semibold">
                  {orders.length === 0 ? 'No orders yet' : 'Nothing here'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {orders.length === 0
                    ? 'When a client submits a project brief on one of your gigs, it will show up here.'
                    : 'No orders match this status filter.'}
                </p>
                {orders.length === 0 && (
                  <Button
                    onClick={() => navigate('/pro/gigs')}
                    className="mt-5 bg-blue-600 hover:bg-blue-700"
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> Polish your gigs
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    perspective="pro"
                    onUpdateStatus={handleUpdate}
                    onRequestPayment={handleRequestPayment}
                    onRefund={handleRefund}
                  />
                ))}

              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-6 flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" /> Orders refresh when you reload the page.
        </p>
      </section>
    </AppLayout>
  );
};

export default ProOrdersInbox;
