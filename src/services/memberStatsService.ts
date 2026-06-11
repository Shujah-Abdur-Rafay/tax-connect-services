// ============================================================================
// memberStatsService — per-user dashboard tiles + recent activity, computed
// live from real Firestore collections (replaces the hardcoded 24 / 12 / 8 / 6
// tiles and the static "Recent Activity" list on MemberDashboard).
//
//   Documents   ← client_documents where owner_id == uid
//   Connections ← connections (accepted) where participants array-contains uid
//   Messages    ← conversations where participants array-contains uid (+ unread)
//   Courses     ← course_enrollments where user_id == uid
//
// Recent activity is a merged, time-sorted feed of the newest items across
// those same collections.
// ============================================================================

import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchConnectionsForUser } from '@/services/connectionsService';
import { fetchEnrollmentsForUser } from '@/services/coursesService';

export interface MemberStats {
  documents: { total: number; deltaWeek: number };
  connections: { total: number; deltaMonth: number };
  messages: { total: number; unread: number };
  courses: { total: number; inProgress: number };
  recentActivity: { action: string; item: string; at: string; timeLabel: string }[];
}

const toMillis = (v: unknown): number | null => {
  if (v == null) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof (v as any)?.toMillis === 'function') {
    try {
      return (v as any).toMillis();
    } catch {
      /* ignore */
    }
  }
  if (typeof (v as any)?.seconds === 'number') return (v as any).seconds * 1000;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

export function relativeTime(ms: number | null): string {
  if (ms == null) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  return `${Math.floor(mo / 12)} year(s) ago`;
}

async function fetchOwnDocuments(uid: string): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'client_documents'), where('owner_id', '==', uid)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  } catch (e) {
    console.warn('[memberStats] client_documents read failed:', e);
    return [];
  }
}

async function fetchOwnConversations(uid: string): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'conversations'), where('participants', 'array-contains', uid)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  } catch (e) {
    console.warn('[memberStats] conversations read failed:', e);
    return [];
  }
}

export async function fetchMemberStats(uid: string): Promise<MemberStats> {
  const empty: MemberStats = {
    documents: { total: 0, deltaWeek: 0 },
    connections: { total: 0, deltaMonth: 0 },
    messages: { total: 0, unread: 0 },
    courses: { total: 0, inProgress: 0 },
    recentActivity: [],
  };
  if (!db || !uid) return empty;

  const [docs, conversations, connections, courses] = await Promise.all([
    fetchOwnDocuments(uid),
    fetchOwnConversations(uid),
    fetchConnectionsForUser(uid),
    fetchEnrollmentsForUser(uid),
  ]);

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  // Documents
  const docTime = (d: any) => toMillis(d.uploaded_at ?? d.created_at);
  const documents = {
    total: docs.length,
    deltaWeek: docs.filter((d) => (docTime(d) ?? 0) >= weekAgo).length,
  };

  // Connections (accepted only)
  const accepted = connections.filter((c) => c.status === 'accepted');
  const connectionsStat = {
    total: accepted.length,
    deltaMonth: accepted.filter((c) => (toMillis(c.created_at) ?? 0) >= monthStart).length,
  };

  // Messages
  const unread = conversations.reduce(
    (sum, c) => sum + Number((c.unreadFor && c.unreadFor[uid]) || 0),
    0,
  );
  const messages = { total: conversations.length, unread };

  // Courses
  const coursesStat = {
    total: courses.length,
    inProgress: courses.filter((c) => c.status === 'in_progress').length,
  };

  // Recent activity feed (merge newest across collections)
  const feed: { action: string; item: string; ms: number }[] = [];
  docs.forEach((d) =>
    feed.push({ action: 'Uploaded', item: d.file_name || 'Document', ms: docTime(d) ?? 0 }),
  );
  accepted.forEach((c) =>
    feed.push({
      action: 'Connected with',
      item: c.requester_uid === uid ? c.recipient_name || 'a professional' : c.requester_name || 'a professional',
      ms: toMillis(c.created_at) ?? 0,
    }),
  );
  courses.forEach((c) =>
    feed.push({
      action: c.status === 'completed' ? 'Completed' : 'Enrolled in',
      item: c.course_title || 'a course',
      ms: toMillis(c.updated_at ?? c.created_at) ?? 0,
    }),
  );
  conversations.forEach((c) =>
    feed.push({
      action: 'Message in',
      item: c.subject || c.professionalName || c.clientName || 'a conversation',
      ms: toMillis(c.lastMessageAt) ?? 0,
    }),
  );

  const recentActivity = feed
    .filter((f) => f.ms > 0)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .map((f) => ({
      action: f.action,
      item: f.item,
      at: new Date(f.ms).toISOString(),
      timeLabel: relativeTime(f.ms),
    }));

  return { documents, connections: connectionsStat, messages, courses: coursesStat, recentActivity };
}
