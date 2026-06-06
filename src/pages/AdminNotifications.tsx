import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ExternalLink,
  Loader2,
  Mail,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  AdminNotification,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  subscribeToAdminNotifications,
} from '@/services/adminNotificationsService';

function categoryColor(category: string): string {
  switch (category) {
    case 'professional_application':
      return 'bg-blue-100 text-blue-800';
    case 'application_approved':
      return 'bg-green-100 text-green-800';
    case 'application_rejected':
      return 'bg-red-100 text-red-800';
    case 'document_uploaded':
    case 'document_reviewed':
      return 'bg-purple-100 text-purple-800';
    case 'appointment_booked':
    case 'appointment_cancelled':
      return 'bg-amber-100 text-amber-800';
    case 'payment_processed':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  try {
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function renderMeta(meta: Record<string, any>): React.ReactNode {
  const entries = Object.entries(meta || {}).filter(
    ([k]) => k !== 'reviewUrl',
  );
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="font-medium text-gray-600 capitalize">
            {k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}:
          </span>
          <span className="text-gray-800 truncate">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminNotifications() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    setListLoading(true);
    const unsub = subscribeToAdminNotifications(
      (data) => {
        setItems(data);
        setListLoading(false);
      },
      () => setListLoading(false),
    );
    return () => unsub();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((n) => {
      if (filter === 'unread' && n.read) return false;
      if (filter === 'read' && !n.read) return false;
      if (!s) return true;
      const haystack = [
        n.subject,
        n.category,
        n.to,
        JSON.stringify(n.meta || {}),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(s);
    });
  }, [items, search, filter]);

  const unreadIds = useMemo(
    () => items.filter((i) => !i.read).map((i) => i.id),
    [items],
  );

  const handleCardClick = async (n: AdminNotification) => {
    if (!n.read) {
      await markAdminNotificationRead(n.id).catch(() => null);
    }
    const url = n.meta?.reviewUrl;
    if (url && typeof url === 'string') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleMarkRead = async (
    e: React.MouseEvent,
    n: AdminNotification,
  ) => {
    e.stopPropagation();
    if (n.read) return;
    await markAdminNotificationRead(n.id).catch(() => null);
  };

  const handleMarkAllRead = async () => {
    if (unreadIds.length === 0) return;
    await markAllAdminNotificationsRead(unreadIds);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view admin notifications.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const unreadCount = unreadIds.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Admin
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="h-7 w-7 text-blue-600" />
              Admin Inbox
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-red-600 text-white text-sm font-semibold">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-1">
              All system notifications routed to info@alliance-tax.com
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search subject, category, recipient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'unread', 'read'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {listLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {items.length === 0
                  ? 'No notifications yet. Admin alerts will appear here automatically.'
                  : 'No notifications match your filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => {
              const hasReviewUrl =
                n.meta?.reviewUrl && typeof n.meta.reviewUrl === 'string';
              return (
                <Card
                  key={n.id}
                  onClick={() => handleCardClick(n)}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${
                    !n.read
                      ? 'border-l-4 border-l-blue-600 bg-white'
                      : 'bg-white'
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {!n.read && (
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
                          )}
                          <h3
                            className={`text-base ${
                              !n.read
                                ? 'font-semibold text-gray-900'
                                : 'font-medium text-gray-800'
                            } truncate`}
                          >
                            {n.subject}
                          </h3>
                          <Badge className={categoryColor(n.category)}>
                            {n.category.replace(/_/g, ' ')}
                          </Badge>
                          {hasReviewUrl && (
                            <span className="inline-flex items-center text-xs text-blue-600">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              opens link
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 flex items-center gap-4 flex-wrap">
                          <span>
                            <span className="font-medium">To:</span> {n.to}
                          </span>
                          <span>
                            <span className="font-medium">When:</span>{' '}
                            {formatDate(n.createdAt)}
                          </span>
                        </div>
                        {renderMeta(n.meta)}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {!n.read ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleMarkRead(e, n)}
                          >
                            Mark as read
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Read
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
