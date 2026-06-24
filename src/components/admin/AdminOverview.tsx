// ============================================================================
// AdminOverview — the admin console landing section (index route of /admin).
//
// A console-style hub: a pending-applications stat plus quick-link cards to
// every section the signed-in admin/help-desk user is permitted to see. Kept
// intentionally light (one best-effort query) so the landing page never hangs.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { AdminNotificationsBadge } from '../AdminNotificationsBadge';
import { getAllApplications } from '@/services/enrollmentService';
import type { AdminPermission } from '@/constants/adminPermissions';
import {
  FileText,
  Users,
  Crown,
  CreditCard,
  TrendingUp,
  Star,
  FolderOpen,
  Shield,
  Wrench,
  ArrowRight,
} from 'lucide-react';

interface QuickLink {
  label: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  perm: AdminPermission;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Applications', description: 'Review professional applications', to: '/admin/applications', icon: FileText, perm: 'applications' },
  { label: 'Professionals', description: 'Manage directory listings', to: '/admin/professionals', icon: Users, perm: 'applications' },
  { label: 'Memberships', description: 'Change membership levels', to: '/admin/memberships', icon: Crown, perm: 'memberships' },
  { label: 'Subscriptions', description: 'Manage recurring billing', to: '/admin/subscriptions', icon: CreditCard, perm: 'subscriptions' },
  { label: 'Payouts', description: 'Commission & payout monitor', to: '/admin/payouts', icon: TrendingUp, perm: 'payouts' },
  { label: 'Reviews', description: 'Moderate client reviews', to: '/admin/reviews', icon: Star, perm: 'reviews' },
  { label: 'Content', description: 'Upload & gate member content', to: '/admin/content', icon: FolderOpen, perm: 'content' },
  { label: 'Admins', description: 'Add admins & permissions', to: '/admin/admins', icon: Shield, perm: 'admins' },
  { label: 'Tools', description: 'CRM, analytics, fees & health', to: '/admin/tools', icon: Wrench, perm: 'tools' },
];

const AdminOverview: React.FC = () => {
  const { user, hasAdminPermission } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!hasAdminPermission('applications')) return;
    let active = true;
    getAllApplications()
      .then((apps) => {
        if (active) setPendingCount(apps.filter((a) => a.status === 'pending').length);
      })
      .catch(() => {
        if (active) setPendingCount(null);
      });
    return () => {
      active = false;
    };
  }, [hasAdminPermission]);

  const links = QUICK_LINKS.filter((l) => hasAdminPermission(l.perm));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back{user?.name ? `, ${user.name}` : ''}. Manage the platform from here.
          </p>
        </div>
        <AdminNotificationsBadge />
      </div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pending applications</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {pendingCount === null ? '—' : pendingCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Console</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">Platform admin</p>
            <p className="text-xs text-slate-500">{links.length} sections available</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Sections
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <l.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{l.label}</div>
                <p className="text-sm text-slate-500">{l.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-500" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
