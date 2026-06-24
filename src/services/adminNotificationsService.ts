import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AdminNotification {
  id: string;
  to: string;
  subject: string;
  category: string;
  meta: Record<string, any>;
  read: boolean;
  createdAt: Date | null;
}

function mapDoc(id: string, data: any): AdminNotification {
  const ts = data?.createdAt;
  let createdAt: Date | null = null;
  if (ts instanceof Timestamp) {
    createdAt = ts.toDate();
  } else if (ts && typeof ts.toDate === 'function') {
    createdAt = ts.toDate();
  } else if (ts && typeof ts.seconds === 'number') {
    createdAt = new Date(ts.seconds * 1000);
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    createdAt = new Date(ts);
  }

  return {
    id,
    to: data?.to || '',
    subject: data?.subject || '(no subject)',
    category: data?.category || 'general',
    meta: data?.meta || {},
    read: !!data?.read,
    createdAt,
  };
}

/**
 * Subscribe to ALL admin notifications, newest first.
 * Returns unsubscribe function.
 */
export function subscribeToAdminNotifications(
  callback: (items: AdminNotification[]) => void,
  onError?: (err: Error) => void,
): () => void {
  try {
    const q = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => mapDoc(d.id, d.data()));
        callback(items);
      },
      (err) => {
        console.warn('admin_notifications subscription error:', err);
        if (onError) onError(err as Error);
      },
    );
  } catch (err) {
    console.warn('Failed to subscribe to admin_notifications:', err);
    if (onError) onError(err as Error);
    return () => {};
  }
}

/**
 * Subscribe just to the UNREAD count (efficient — no orderBy needed).
 */
export function subscribeToUnreadAdminNotificationsCount(
  callback: (count: number) => void,
): () => void {
  try {
    const q = query(collection(db, 'admin_notifications'), where('read', '==', false));
    return onSnapshot(
      q,
      (snap) => callback(snap.size),
      (err) => {
        console.warn('unread admin_notifications count error:', err);
        callback(0);
      },
    );
  } catch (err) {
    console.warn('Failed to subscribe to unread count:', err);
    callback(0);
    return () => {};
  }
}

export async function markAdminNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'admin_notifications', id), {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to mark notification as read:', err);
    throw err;
  }
}

export async function markAllAdminNotificationsRead(
  ids: string[],
): Promise<void> {
  await Promise.all(ids.map((id) => markAdminNotificationRead(id).catch(() => null)));
}
