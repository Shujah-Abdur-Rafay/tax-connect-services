// ============================================================================
// AdminContent — /admin/content
//
// Admin-only page for the Content Management module. Wraps AdminContentManager
// (the shared upload form + library list) in the standard Header/Footer shell
// and gates access to platform administrators.
// ============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, FolderOpen, RefreshCw } from 'lucide-react';
import AdminContentManager from '@/components/admin/AdminContentManager';

export default function AdminContent() {
  const { user, hasAdminPermission, loading } = useAuth();
  const canManageContent = hasAdminPermission('content');

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24 text-slate-600">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      </Shell>
    );
  }

  if (!user || !canManageContent) {
    return (
      <Shell>
        <Card className="mx-auto mt-12 max-w-2xl border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              Admin only
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-slate-600">
              The Content Management tool is restricted to platform administrators.
            </p>
            <Button asChild variant="outline">
              <Link to="/admin">Back to admin</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/admin" className="hover:text-slate-700">
            Admin
          </Link>
          <span>/</span>
          <span className="text-slate-700">Content Management</span>
        </div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
          <FolderOpen className="h-8 w-8 text-blue-600" />
          Content Management
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Upload PDFs, links, and videos and assign each to one or more audience categories. Members
          only see content for the categories they belong to.
        </p>
      </div>

      <AdminContentManager />
    </Shell>
  );
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen flex-col bg-slate-50">
    <Header onToggleNotifications={() => {}} />
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
    <Footer />
  </div>
);
