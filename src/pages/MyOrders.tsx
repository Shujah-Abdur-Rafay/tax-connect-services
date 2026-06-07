import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import OrderCard from '@/components/orders/OrderCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReviewSubmissionForm } from '@/components/ReviewSubmissionForm';
import { getReviewsByClient } from '@/services/reviewsService';
import {
  fetchOrdersForClient,
  updateOrderStatus,
  confirmOrderPayment,
  refundGigOrder,
  addOrderSourceFiles,
  removeOrderSourceFile,
  type GigOrderRecord,
  type GigOrderStatus,
  type GigOrderSourceFile,
} from '@/services/gigOrdersService';

import {
  Package,
  Loader2,
  ShoppingBag,
  Search,
  DollarSign,
  ShieldCheck,
  Undo2,
  Star,
} from 'lucide-react';


const TABS: { value: 'all' | GigOrderStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'Awaiting pro' },
  { value: 'awaiting_payment', label: 'Pay to start' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const MyOrders: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<GigOrderRecord[]>([]);
  const [tab, setTab] = useState<'all' | GigOrderStatus>('all');
  const [verifying, setVerifying] = useState(false);
  // Pro ids the client has already reviewed (so we show "Reviewed ✓" vs a prompt).
  const [reviewedProIds, setReviewedProIds] = useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<GigOrderRecord | null>(null);

  const load = async (uid: string) => {
    setLoading(true);
    try {
      const list = await fetchOrdersForClient(uid);
      setOrders(list);
      try {
        const myReviews = await getReviewsByClient(uid);
        setReviewedProIds(new Set(myReviews.map((r) => r.professional_id)));
      } catch {
        /* non-fatal — review prompt just shows for all completed orders */
      }
    } catch (e: any) {
      toast({
        title: 'Could not load your orders',
        description: e?.message || 'Try refreshing the page.',
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

  // Handle Stripe Checkout return: ?gig_order_id=...&session_id=...
  // ALSO handle the post-delivery deep-link from the email:
  // ?gig_order_id=... (no session_id, no cancelled) — switch to the
  // Delivered tab and scroll the matching order into view so the client
  // lands right on the file list / Accept button.
  useEffect(() => {
    if (!user) return;
    const orderId = searchParams.get('gig_order_id');
    const sessionId = searchParams.get('session_id');
    const cancelled = searchParams.get('cancelled');

    if (cancelled && orderId) {
      toast({
        title: 'Payment cancelled',
        description: 'You can still pay for this order any time from this page.',
      });
      const next = new URLSearchParams(searchParams);
      next.delete('gig_order_id');
      next.delete('cancelled');
      setSearchParams(next, { replace: true });
      return;
    }

    if (orderId && sessionId && !verifying) {
      (async () => {
        setVerifying(true);
        try {
          const updated = await confirmOrderPayment(orderId, sessionId, user.uid);
          setOrders((prev) => {
            const has = prev.some((o) => o.id === updated.id);
            return has ? prev.map((o) => (o.id === updated.id ? updated : o)) : [updated, ...prev];
          });
          toast({
            title: 'Payment received',
            description: `Order #${updated.id.slice(0, 8)} is now in progress.`,
          });
          setTab('in_progress');
        } catch (e: any) {
          toast({
            title: 'Could not confirm payment',
            description: e?.message || 'Refresh the page to retry.',
            variant: 'destructive',
          });
        } finally {
          setVerifying(false);
          const next = new URLSearchParams(searchParams);
          next.delete('gig_order_id');
          next.delete('session_id');
          setSearchParams(next, { replace: true });
        }
      })();
      return;
    }

    // Pure deep-link from the "Your delivery is ready" email.
    // Only act once orders have loaded so we can verify the order exists
    // before switching tabs (otherwise the user sees an empty Delivered tab
    // for a frame, which is jarring).
    if (orderId && !sessionId && !cancelled && !loading && orders.length > 0) {
      const target = orders.find((o) => o.id === orderId);
      if (target) {
        // Pick the tab that contains the order so it's visible.
        if (target.status && target.status !== 'all' && tab !== target.status) {
          setTab(target.status as GigOrderStatus);
        }
        // Defer scroll a tick so the tab content has rendered.
        requestAnimationFrame(() => {
          const el = document.getElementById(`order-${orderId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('ring-2', 'ring-violet-400', 'ring-offset-2');
            setTimeout(
              () => el.classList.remove('ring-2', 'ring-violet-400', 'ring-offset-2'),
              2500
            );
          }
        });
      }
      const next = new URLSearchParams(searchParams);
      next.delete('gig_order_id');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams, loading, orders.length]);


  const handleUpdate = async (
    orderId: string,
    status: GigOrderStatus,
    extra?: { deliveryMessage?: string }
  ) => {
    if (!user) return;
    try {
      const updated = await updateOrderStatus(orderId, user.uid, status, extra);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      toast({
        title: status === 'completed' ? 'Order completed' : `Order ${status.replace('_', ' ')}`,
      });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
  };

  const handlePayNow = (order: GigOrderRecord) => {
    if (order.checkout_url) {
      window.location.href = order.checkout_url;
    } else {
      toast({
        title: 'Checkout link missing',
        description: 'Ask the pro to resend the payment request.',
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
        title: 'Refund processed',
        description: `$${updated.refund_amount ?? updated.price} is on its way back to your card via Stripe (typically 5–10 business days).`,
      });
    } catch (e: any) {
      toast({
        title: 'Refund failed',
        description: e?.message || 'Please try again or contact support.',
        variant: 'destructive',
      });
    }
  };

  // Client-only: persist newly-uploaded source documents (W-2s, 1099s, etc.)
  // to the order's source_files array. The OrderCard does the Storage upload
  // first, then calls this with the resulting metadata.
  const handleAddSourceFiles = async (
    orderId: string,
    files: GigOrderSourceFile[]
  ) => {
    if (!user) return;
    const updated = await addOrderSourceFiles(orderId, user.uid, files);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleRemoveSourceFile = async (orderId: string, storagePath: string) => {
    if (!user) return;
    const updated = await removeOrderSourceFile(orderId, user.uid, storagePath);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };



  const filtered = useMemo(() => {
    if (tab === 'all') return orders;
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  const stats = useMemo(() => {
    const totalSpent = orders
      .filter((o) => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.price || 0), 0);
    const refundedTotal = orders
      .filter((o) => o.payment_status === 'refunded')
      .reduce((sum, o) => sum + (o.refund_amount ?? o.price ?? 0), 0);
    return {
      total: orders.length,
      awaitingPayment: orders.filter((o) => o.status === 'awaiting_payment').length,
      active: orders.filter((o) =>
        ['new', 'awaiting_payment', 'in_progress', 'delivered'].includes(o.status)
      ).length,
      completed: orders.filter((o) => o.status === 'completed').length,
      spent: totalSpent,
      refundedTotal,
    };
  }, [orders]);


  return (
    <AppLayout>
      <section className="border-b bg-gradient-to-br from-emerald-900 via-teal-800 to-blue-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-10">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <ShoppingBag className="h-3 w-3" /> My Orders
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">Your tax projects</h1>
            <p className="mt-1 text-emerald-50">
              Track briefs you've sent, pay securely with Stripe, and accept deliveries from your pros.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/tax-gigs')}
            className="bg-white text-slate-900 hover:bg-emerald-50"
          >
            <Search className="mr-2 h-4 w-4" /> Browse more gigs
          </Button>
        </div>
      </section>

      {verifying && (
        <div className="border-b bg-emerald-50">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm text-emerald-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirming your Stripe payment…
          </div>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total orders</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-orange-600">Pay to start</p>
            <p className="mt-1 text-2xl font-bold text-orange-700">{stats.awaitingPayment}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-amber-600">Active</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{stats.active}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-green-600">Completed</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{stats.completed}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-blue-600 flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Total paid
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-700">
              ${stats.spent.toLocaleString()}
            </p>
          </Card>
        </div>

        {stats.awaitingPayment > 0 && (
          <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-orange-600" />
              <div className="flex-1">
                <p className="font-semibold text-orange-900">
                  {stats.awaitingPayment} order{stats.awaitingPayment === 1 ? '' : 's'} waiting on payment
                </p>
                <p className="mt-0.5 text-sm text-orange-800">
                  Your pro has accepted and is ready to start. Complete Stripe Checkout to unlock work.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => setTab('awaiting_payment')}
              >
                Review
              </Button>
            </div>
          </div>
        )}

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
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your orders…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
                <Package className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <h3 className="text-lg font-semibold">
                  {orders.length === 0 ? 'No orders yet' : 'Nothing here'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {orders.length === 0
                    ? "When you send a project brief to a pro, it'll appear here so you can track progress."
                    : 'No orders match this status filter.'}
                </p>
                {orders.length === 0 && (
                  <Button
                    onClick={() => navigate('/tax-gigs')}
                    className="mt-5 bg-blue-600 hover:bg-blue-700"
                  >
                    <Search className="mr-2 h-4 w-4" /> Find a tax pro
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((o) => {
                  const canReview =
                    (o.status === 'completed' || o.status === 'delivered') && !!o.pro_id;
                  const alreadyReviewed = reviewedProIds.has(o.pro_id);
                  return (
                    <div key={o.id} className="space-y-2">
                      <OrderCard
                        order={o}
                        perspective="client"
                        onUpdateStatus={handleUpdate}
                        onPayNow={handlePayNow}
                        onRefund={handleRefund}
                        onAddSourceFiles={handleAddSourceFiles}
                        onRemoveSourceFile={handleRemoveSourceFile}
                      />
                      {canReview && (
                        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                          <div className="flex items-center gap-2 text-sm text-amber-900">
                            <Star className="h-4 w-4 text-amber-500" />
                            {alreadyReviewed
                              ? `Thanks for reviewing ${o.pro_name || 'your pro'}!`
                              : `How was working with ${o.pro_name || 'your pro'}?`}
                          </div>
                          {alreadyReviewed ? (
                            <span className="text-xs font-medium text-green-700">Reviewed ✓</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-300 text-amber-800 hover:bg-amber-100"
                              onClick={() => setReviewTarget(o)}
                            >
                              <Star className="mr-1.5 h-4 w-4" />
                              Leave a review
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Review-on-completion prompt (Phase 2) */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review your experience</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <ReviewSubmissionForm
              professionalId={reviewTarget.pro_id}
              professionalName={reviewTarget.pro_name || 'your tax pro'}
              onSuccess={() => {
                setReviewedProIds((prev) => new Set(prev).add(reviewTarget.pro_id));
                setReviewTarget(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MyOrders;
