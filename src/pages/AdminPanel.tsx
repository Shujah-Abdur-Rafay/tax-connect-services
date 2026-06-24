import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * AdminPanel — the /admin route LAYOUT.
 *
 * Gates the entire admin console on canAccessAdmin, then renders the dedicated
 * dark AdminLayout shell whose <Outlet /> hosts the individual /admin/* section
 * routes (see App.tsx). Replaces the previous single tabbed dashboard so the
 * admin area is structurally separated from the user-facing app.
 */
export default function AdminPanel() {
  const { user, loading, canAccessAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!canAccessAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to access the admin panel. Please contact an administrator
            if you believe this is an error.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <AdminLayout />;
}
