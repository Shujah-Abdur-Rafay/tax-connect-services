import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { subscribeToUnreadAdminNotificationsCount } from '@/services/adminNotificationsService';

interface AdminNotificationsBadgeProps {
  className?: string;
  /** If true, render only the badge count number (for embedding in other nav items). */
  compact?: boolean;
}

/**
 * Bell icon + red unread count badge that links to /admin/notifications.
 * Subscribes in real-time to the `admin_notifications` Firestore collection.
 */
export function AdminNotificationsBadge({
  className = '',
  compact = false,
}: AdminNotificationsBadgeProps) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const unsub = subscribeToUnreadAdminNotificationsCount(setUnread);
    return () => unsub();
  }, []);

  if (compact) {
    if (unread <= 0) return null;
    return (
      <span
        className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-semibold ${className}`}
        aria-label={`${unread} unread admin notifications`}
      >
        {unread > 99 ? '99+' : unread}
      </span>
    );
  }

  return (
    <Link
      to="/admin/notifications"
      className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors ${className}`}
      aria-label={`Admin notifications${unread > 0 ? `, ${unread} unread` : ''}`}
    >
      <Bell className="h-5 w-5 text-gray-700" />
      <span className="text-sm font-medium text-gray-700 hidden sm:inline">Inbox</span>
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-semibold shadow">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}

export default AdminNotificationsBadge;
