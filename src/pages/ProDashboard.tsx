import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { ServiceManagementDashboard } from '@/components/ServiceManagementDashboard';
import AppointmentsList from '@/components/AppointmentsList';
import MessagingCenter from '@/components/MessagingCenter';
import ProfessionalDocumentViewer from '@/components/ProfessionalDocumentViewer';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import ResourceCenter from '@/components/ResourceCenter';
import ProLeadsInbox from '@/components/pro/ProLeadsInbox';
import ProEarningsSummary from '@/components/pro/ProEarningsSummary';
import SubscriptionBilling from '@/components/pro/SubscriptionBilling';
import ServiceBureauPanel from '@/components/pro/ServiceBureauPanel';
import { isServiceBureau } from '@/constants/membershipLevels';
import {
  LayoutDashboard,
  UserCog,
  Inbox,
  CalendarDays,
  MessageSquare,
  FolderOpen,
  TrendingUp,
  Star,
  Library,
  ShoppingBag,
  Banknote,
  Briefcase,
  CreditCard,
  Building2,
  ExternalLink,
  ArrowRight,
  Lock,
} from 'lucide-react';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'profile', label: 'Profile & Services', icon: UserCog },
  { value: 'leads', label: 'Leads', icon: Inbox },
  { value: 'appointments', label: 'Appointments', icon: CalendarDays },
  { value: 'messages', label: 'Messages', icon: MessageSquare },
  { value: 'documents', label: 'Documents', icon: FolderOpen },
  { value: 'earnings', label: 'Earnings', icon: TrendingUp },
  { value: 'billing', label: 'Billing', icon: CreditCard },
  { value: 'reviews', label: 'Reviews', icon: Star },
  { value: 'resources', label: 'Resources', icon: Library },
  // Visible only to Service Bureau Partners (filtered below).
  { value: 'bureau', label: 'Service Bureau', icon: Building2, serviceBureauOnly: true },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/**
 * Phase 3 — Consolidated Professional Dashboard (/pro/dashboard).
 *
 * One hub for everything a tax pro manages: their public profile + service
 * pricing, inbound leads & inquiries, appointments, messages, documents,
 * earnings + commissions, reviews, and the tier-gated Resource Center. Existing
 * standalone tools (gig packages, orders inbox, Stripe payouts) are linked from
 * the Overview so this page consolidates rather than duplicates them.
 */
const ProDashboard: React.FC = () => {
  const { user, isLoading, isProfessional } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>('overview');

  useEffect(() => {
    const tab = searchParams.get('tab') as TabValue | null;
    if (tab && TABS.some((t) => t.value === tab)) setActiveTab(tab);
  }, [searchParams]);

  const changeTab = (value: string) => {
    setActiveTab(value as TabValue);
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header onToggleNotifications={() => {}} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-slate-500">Loading your dashboard…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header onToggleNotifications={() => {}} />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Lock className="h-6 w-6" />
              </div>
              <CardTitle>Pro Dashboard</CardTitle>
              <CardDescription>Sign in to your professional account to continue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={() => navigate('/')}>
                Go to homepage
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isProfessional) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header onToggleNotifications={() => {}} />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
          <Card className="border-amber-200">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Briefcase className="h-6 w-6" />
              </div>
              <CardTitle>For tax professionals</CardTitle>
              <CardDescription>
                The pro dashboard is available to professional accounts. Join the platform to get a
                free directory listing and your own dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link to="/join-platform">Join as a pro</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/member-portal">Member portal</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const userIsBureau = isServiceBureau(user.membershipLevel ? String(user.membershipLevel) : undefined);
  const visibleTabs = TABS.filter(
    (t) => !('serviceBureauOnly' in t && t.serviceBureauOnly) || userIsBureau,
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header onToggleNotifications={() => {}} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Pro Dashboard</h1>
          <p className="mt-1 text-slate-600">
            Welcome back, {user.name} — manage your practice from one place.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={changeTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:flex lg:w-auto lg:flex-wrap">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:text-blue-700">
                <t.icon className="h-4 w-4 lg:mr-2" />
                <span className="ml-1 hidden lg:inline">{t.label}</span>
                <span className="ml-1 text-xs lg:hidden">{t.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <Overview onNavigateTab={changeTab} />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileAndServices uid={user.uid} />
          </TabsContent>

          <TabsContent value="leads">
            <ProLeadsInbox professionalId={user.uid} />
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentsList professionalId={user.uid} />
          </TabsContent>

          <TabsContent value="messages">
            <MessagingCenter currentUserId={user.id} />
          </TabsContent>

          <TabsContent value="documents">
            <ProfessionalDocumentViewer />
          </TabsContent>

          <TabsContent value="earnings">
            <ProEarningsSummary professionalId={user.uid} />
          </TabsContent>

          <TabsContent value="billing">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Membership &amp; billing</h2>
                <p className="text-sm text-slate-600">
                  Manage your recurring membership subscription and payment method.
                </p>
              </div>
              <SubscriptionBilling />
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Your Reviews</CardTitle>
                <CardDescription>
                  Client reviews of your work. You can respond to each one to build trust.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReviewDisplay professionalId={user.uid} isProfessionalView />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources">
            <ResourceCenter />
          </TabsContent>

          {userIsBureau && (
            <TabsContent value="bureau">
              <ServiceBureauPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

// ── Overview hub ──────────────────────────────────────────────────────────
const Overview: React.FC<{ onNavigateTab: (tab: string) => void }> = ({ onNavigateTab }) => {
  const inDashboard: { label: string; description: string; icon: React.ComponentType<{ className?: string }>; tab: string }[] = [
    { label: 'Profile & Services', description: 'Edit your services and pricing', icon: UserCog, tab: 'profile' },
    { label: 'Leads & Inquiries', description: 'Follow up with new clients', icon: Inbox, tab: 'leads' },
    { label: 'Appointments', description: 'Confirm and track bookings', icon: CalendarDays, tab: 'appointments' },
    { label: 'Messages', description: 'Chat with your clients', icon: MessageSquare, tab: 'messages' },
    { label: 'Earnings', description: 'Net pay after commission', icon: TrendingUp, tab: 'earnings' },
    { label: 'Membership & Billing', description: 'Subscription & payment', icon: CreditCard, tab: 'billing' },
    { label: 'Reviews', description: 'Respond to client reviews', icon: Star, tab: 'reviews' },
    { label: 'Resource Center', description: 'Training, guides & marketing', icon: Library, tab: 'resources' },
    { label: 'Documents', description: 'Shared client documents', icon: FolderOpen, tab: 'documents' },
  ];

  const standalone: { label: string; description: string; icon: React.ComponentType<{ className?: string }>; to: string }[] = [
    { label: 'My Gigs', description: 'Manage your gig packages', icon: Briefcase, to: '/pro/gigs' },
    { label: 'Orders Inbox', description: 'Deliver & manage orders', icon: ShoppingBag, to: '/pro/orders' },
    { label: 'Stripe Payouts', description: 'Bank balance & transfers', icon: Banknote, to: '/pro-payouts' },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Manage your practice</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {inDashboard.map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => onNavigateTab(item.tab)}
              className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-blue-300 hover:shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{item.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
              </div>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {standalone.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-violet-300 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 group-hover:bg-violet-100">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  {item.label}
                  <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-violet-500" />
                </div>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

// ── Profile & Services tab ──────────────────────────────────────────────────
const ProfileAndServices: React.FC<{ uid: string }> = ({ uid }) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Public profile</CardTitle>
        <CardDescription>
          Your name, bio, credentials, photo, and category tags power your{' '}
          <span className="font-medium">/preparer</span> landing page and directory listing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/onboarding">
            <UserCog className="mr-2 h-4 w-4" />
            Edit full profile
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/pro/gigs">
            <Briefcase className="mr-2 h-4 w-4" />
            Manage gig packages
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/professional/${uid}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View public profile
          </Link>
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Services &amp; pricing</CardTitle>
        <CardDescription>
          The à-la-carte services shown on your profile. Drag to reorder, toggle to show/hide.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ServiceManagementDashboard professionalId={uid} />
      </CardContent>
    </Card>
  </div>
);

export default ProDashboard;
