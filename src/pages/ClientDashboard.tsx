import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import MessagingCenter from '@/components/MessagingCenter';
import EnhancedDocumentManager from '@/components/EnhancedDocumentManager';
import ClientAppointmentsList from '@/components/client/ClientAppointmentsList';
import { fetchOrdersForClient, ORDER_STATUS_META, type GigOrderRecord } from '@/services/gigOrdersService';
import { getReviewsByClient, type Review } from '@/services/reviewsService';
import {
  LayoutDashboard,
  ShoppingBag,
  CalendarDays,
  MessageSquare,
  FolderOpen,
  Star,
  ArrowRight,
  Search,
  Lock,
} from 'lucide-react';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'orders', label: 'Orders', icon: ShoppingBag },
  { value: 'appointments', label: 'Appointments', icon: CalendarDays },
  { value: 'messages', label: 'Messages', icon: MessageSquare },
  { value: 'documents', label: 'Documents', icon: FolderOpen },
  { value: 'reviews', label: 'Reviews', icon: Star },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/**
 * Phase 2 — unified Client Home (/client/dashboard). One place for a client to
 * see their orders, appointments, messages, documents, and the reviews they've
 * written. The feature-rich order workspace stays at /my-orders; this hub
 * surfaces summaries + deep links.
 */
const ClientDashboard: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>('overview');

  const [orders, setOrders] = useState<GigOrderRecord[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabValue | null;
    if (tab && TABS.some((t) => t.value === tab)) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || !user?.uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ords, revs] = await Promise.all([
          fetchOrdersForClient(user.uid).catch(() => []),
          getReviewsByClient(user.uid).catch(() => []),
        ]);
        if (cancelled) return;
        setOrders(ords);
        setReviews(revs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, isLoading]);

  const changeTab = (value: string) => {
    setActiveTab(value as TabValue);
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const stats = useMemo(() => {
    const active = orders.filter((o) =>
      ['new', 'awaiting_payment', 'in_progress', 'delivered'].includes(o.status),
    ).length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    return { total: orders.length, active, completed, reviews: reviews.length };
  }, [orders, reviews]);

  if (isLoading) {
    return (
      <Shell>
        <p className="py-20 text-center text-slate-500">Loading your dashboard…</p>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Card className="mx-auto mt-12 max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle>Your dashboard</CardTitle>
            <CardDescription>Sign in to see your orders, appointments, and messages.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>
              Go to homepage
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.name}</h1>
        <p className="mt-1 text-slate-600">Your tax projects, appointments, and messages in one place.</p>
      </div>

      <Tabs value={activeTab} onValueChange={changeTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:flex lg:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon className="h-4 w-4 lg:mr-2" />
              <span className="ml-1 hidden lg:inline">{t.label}</span>
              <span className="ml-1 text-xs lg:hidden">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total orders" value={stats.total} loading={loading} />
              <StatCard label="Active" value={stats.active} loading={loading} accent="text-amber-700" />
              <StatCard label="Completed" value={stats.completed} loading={loading} accent="text-green-700" />
              <StatCard label="Reviews written" value={stats.reviews} loading={loading} accent="text-blue-700" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <HubLink onClick={() => navigate('/my-orders')} icon={ShoppingBag} label="My Orders" desc="Track & pay for projects" />
              <HubLink onClick={() => changeTab('appointments')} icon={CalendarDays} label="Appointments" desc="Your booked consultations" />
              <HubLink onClick={() => changeTab('messages')} icon={MessageSquare} label="Messages" desc="Chat with your pros" />
              <HubLink onClick={() => changeTab('documents')} icon={FolderOpen} label="Documents" desc="Your secure files" />
              <HubLink onClick={() => changeTab('reviews')} icon={Star} label="Reviews" desc="Reviews you've written" />
              <HubLink onClick={() => navigate('/find-professionals')} icon={Search} label="Find a pro" desc="Browse the directory" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent orders</CardTitle>
                  <CardDescription>Your latest tax projects.</CardDescription>
                </div>
                <Button onClick={() => navigate('/my-orders')}>
                  Open full workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32" />
              ) : orders.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No orders yet.{' '}
                  <Link to="/tax-gigs" className="text-blue-600 hover:underline">
                    Find a tax pro
                  </Link>{' '}
                  to get started.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.slice(0, 6).map((o) => {
                    const meta = ORDER_STATUS_META[o.status];
                    return (
                      <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{o.gig_title || 'Gig order'}</div>
                          <div className="text-xs text-slate-500">{o.pro_name || 'Tax pro'}</div>
                        </div>
                        {meta && (
                          <Badge variant="outline" className={meta.color}>
                            {meta.label}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <ClientAppointmentsList clientId={user.uid} />
        </TabsContent>

        <TabsContent value="messages">
          <MessagingCenter currentUserId={user.id} />
        </TabsContent>

        <TabsContent value="documents">
          <EnhancedDocumentManager />
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Reviews you've written</CardTitle>
              <CardDescription>Feedback you've left for the pros you've worked with.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32" />
              ) : reviews.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  You haven't written any reviews yet. Complete an order and share your experience!
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-1 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                          />
                        ))}
                        {r.is_hidden && (
                          <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700">
                            Under review
                          </Badge>
                        )}
                      </div>
                      {r.title && <div className="font-medium text-slate-800">{r.title}</div>}
                      <p className="mt-0.5 text-sm text-slate-600">{r.review_text}</p>
                      <div className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen flex-col bg-slate-50">
    <Header onToggleNotifications={() => {}} />
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    <Footer />
  </div>
);

const StatCard: React.FC<{ label: string; value: number; loading: boolean; accent?: string }> = ({
  label,
  value,
  loading,
  accent = 'text-slate-900',
}) => (
  <Card>
    <CardContent className="pt-6">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-12" />
      ) : (
        <p className={`mt-1 text-3xl font-bold ${accent}`}>{value}</p>
      )}
    </CardContent>
  </Card>
);

const HubLink: React.FC<{
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}> = ({ onClick, icon: Icon, label, desc }) => (
  <button
    type="button"
    onClick={onClick}
    className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-blue-300 hover:shadow-sm"
  >
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex items-center justify-between">
      <span className="font-semibold text-slate-900">{label}</span>
      <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
    </div>
    <p className="mt-1 text-sm text-slate-500">{desc}</p>
  </button>
);

export default ClientDashboard;
