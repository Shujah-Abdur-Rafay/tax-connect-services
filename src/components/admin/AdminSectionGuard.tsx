// ============================================================================
// AdminSectionGuard — per-section permission gate for the admin console.
//
// The whole /admin area is already gated on canAccessAdmin by AdminPanel, but
// help-desk users only hold a subset of permissions. This wraps an individual
// routed section and shows an "insufficient permission" notice (rather than the
// module) when the signed-in user lacks the required AdminPermission. Full
// admins always pass.
// ============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminPermission } from '@/constants/adminPermissions';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  perm: AdminPermission;
  children: React.ReactNode;
}

const AdminSectionGuard: React.FC<Props> = ({ perm, children }) => {
  const { hasAdminPermission } = useAuth();
  if (hasAdminPermission(perm)) return <>{children}</>;

  return (
    <div className="mx-auto mt-8 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-600" />
      <h2 className="text-lg font-semibold text-slate-900">Not permitted</h2>
      <p className="mt-1 text-sm text-slate-600">
        Your account doesn’t have access to this section. Contact a platform administrator if
        you believe this is an error.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/admin">Back to dashboard</Link>
      </Button>
    </div>
  );
};

export default AdminSectionGuard;
