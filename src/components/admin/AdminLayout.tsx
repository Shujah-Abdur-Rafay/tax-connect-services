// ============================================================================
// AdminLayout — dedicated admin console shell.
//
// A deliberately distinct, dark-slate console that does NOT reuse the public
// marketing Header/Footer. A fixed left sidebar holds permission-aware section
// links + the standalone admin tools; the right side is a light content canvas.
// This gives the admin area its own structure and look, clearly separated from
// the normal user views/workflows.
//
// Used two ways:
//   • As a route layout element — renders <Outlet /> for nested /admin/* routes.
//   • As a wrapper — <AdminLayout>{children}</AdminLayout> for standalone pages.
//
// Access is gated by the parent (AdminPanel) on canAccessAdmin; individual
// links are filtered by hasAdminPermission so help-desk staff see only what
// they're granted.
// ============================================================================

import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminPermission } from '@/constants/adminPermissions';
import {
  LayoutDashboard,
  FileText,
  Users,
  Crown,
  CreditCard,
  TrendingUp,
  Star,
  FolderOpen,
  Shield,
  Wrench,
  Percent,
  Library,
  Megaphone,
  Users2,
  Inbox,
  FileSignature,
  BarChart3,
  Activity,
  Database,
  Bell,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Permission required to see the link (undefined = any admin-area user). */
  perm?: AdminPermission;
  /** Exact-match active highlighting (used for the index route). */
  end?: boolean;
}

// Primary console sections (mirror the old dashboard tabs, now routed).
const SECTIONS: NavItem[] = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Applications', to: '/admin/applications', icon: FileText, perm: 'applications' },
  { label: 'Professionals', to: '/admin/professionals', icon: Users, perm: 'applications' },
  { label: 'Memberships', to: '/admin/memberships', icon: Crown, perm: 'memberships' },
  { label: 'Subscriptions', to: '/admin/subscriptions', icon: CreditCard, perm: 'subscriptions' },
  { label: 'Payouts', to: '/admin/payouts', icon: TrendingUp, perm: 'payouts' },
  { label: 'Reviews', to: '/admin/reviews', icon: Star, perm: 'reviews' },
  { label: 'Content', to: '/admin/content', icon: FolderOpen, perm: 'content' },
  { label: 'Admins', to: '/admin/admins', icon: Shield, perm: 'admins' },
  { label: 'Tools', to: '/admin/tools', icon: Wrench, perm: 'tools', end: true },
];

// Standalone tools (all under the 'tools' permission).
const TOOLS: NavItem[] = [
  { label: 'Support inbox', to: '/admin/contact-submissions', icon: Inbox, perm: 'tools' },
  { label: 'Announcements', to: '/admin/crm-broadcast', icon: Megaphone, perm: 'tools' },
  { label: 'CRM contacts', to: '/admin/crm-contacts', icon: Users2, perm: 'tools' },
  { label: 'Resource Center', to: '/admin/resources', icon: Library, perm: 'content' },
  { label: 'Platform fees', to: '/admin/platform-fees', icon: Percent, perm: 'tools' },
  { label: 'Enrollments', to: '/admin/enrollments', icon: ClipboardList, perm: 'tools' },
  { label: 'Signed agreements', to: '/admin/signed-agreements', icon: FileSignature, perm: 'tools' },
  { label: 'Landing analytics', to: '/admin/landing-analytics', icon: BarChart3, perm: 'tools' },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell, perm: 'tools' },
  { label: 'Stripe health', to: '/admin/stripe-health', icon: Activity, perm: 'tools' },
  { label: 'Firestore health', to: '/admin/firestore-health', icon: Database, perm: 'tools' },
];

const isActive = (pathname: string, item: NavItem): boolean =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/');

const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, hasAdminPermission, isHelpDesk, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSections = SECTIONS.filter((s) => !s.perm || hasAdminPermission(s.perm));
  const visibleTools = TOOLS.filter((t) => !t.perm || hasAdminPermission(t.perm));

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/');
    }
  };

  const NavLink: React.FC<{ item: NavItem }> = ({ item }) => {
    const active = isActive(location.pathname, item);
    return (
      <Link
        to={item.to}
        onClick={() => setMobileOpen(false)}
        className={
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
          (active
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white')
        }
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full w-64 flex-col bg-slate-900 text-slate-100">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide text-white">ADMIN CONSOLE</div>
          <div className="text-[11px] text-slate-400">
            {isHelpDesk ? 'Help Desk' : 'Platform administration'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleSections.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}

        {visibleTools.length > 0 && (
          <div className="pt-4">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tools
            </div>
            {visibleTools.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
          </div>
        )}
      </nav>

      {/* Identity + actions */}
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 truncate px-2 text-xs text-slate-400">
          {user?.email || 'Signed in'}
        </div>
        <Link
          to="/"
          className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          onClick={() => setMobileOpen(false)}
        >
          <ExternalLink className="h-4 w-4" />
          View site
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-shrink-0 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white lg:hidden">
          <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-bold tracking-wide">ADMIN CONSOLE</span>
          <span className="w-5" />
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
