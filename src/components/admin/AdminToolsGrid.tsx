import React from 'react';
import { Link } from 'react-router-dom';
import {
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
} from 'lucide-react';

interface Tool {
  label: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Phase 5 — quick-access grid linking the admin dashboard to the standalone
 * admin tools (support inbox, announcements, fees, resources, analytics,
 * health) so everything lives one click from /admin.
 */
const TOOLS: Tool[] = [
  { label: 'Support inbox', description: 'Contact & support requests', to: '/admin/contact-submissions', icon: Inbox },
  { label: 'Announcements', description: 'Broadcast email to members', to: '/admin/crm-broadcast', icon: Megaphone },
  { label: 'CRM contacts', description: 'Synced contact list', to: '/admin/crm-contacts', icon: Users2 },
  { label: 'Resource Center', description: 'Upload training & guides', to: '/admin/resources', icon: Library },
  { label: 'Platform fees', description: 'Commission split %', to: '/admin/platform-fees', icon: Percent },
  { label: 'Enrollments', description: 'Application submissions', to: '/admin/enrollments', icon: ClipboardList },
  { label: 'Signed agreements', description: 'E-signed onboarding docs', to: '/admin/signed-agreements', icon: FileSignature },
  { label: 'Landing analytics', description: 'Funnel & conversion data', to: '/admin/landing-analytics', icon: BarChart3 },
  { label: 'Notifications', description: 'Admin alerts feed', to: '/admin/notifications', icon: Bell },
  { label: 'Stripe health', description: 'Payments diagnostics', to: '/admin/stripe-health', icon: Activity },
  { label: 'Firestore health', description: 'Database diagnostics', to: '/admin/firestore-health', icon: Database },
];

const AdminToolsGrid: React.FC = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Admin tools</h2>
      <p className="text-sm text-slate-500">Everything else you manage, one click away.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
            <t.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900">{t.label}</div>
            <p className="text-sm text-slate-500">{t.description}</p>
          </div>
        </Link>
      ))}
    </div>
  </div>
);

export default AdminToolsGrid;
