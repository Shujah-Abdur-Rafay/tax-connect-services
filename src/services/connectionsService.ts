// ============================================================================
// connectionsService — professional ↔ member network links, backed by
// Firestore `connections`. Powers the "Connections" tile + count on the member
// dashboard and the connection count in platform analytics.
//
// Firestore schema (connections/{id}):
//   requester_uid  — uid who sent the request (rule: create only own)
//   recipient_uid  — uid who received it
//   participants   — [requester_uid, recipient_uid]  (for array-contains queries)
//   requester_name / recipient_name — display snapshots
//   status         — 'pending' | 'accepted' | 'declined'
//   created_at / updated_at — serverTimestamp
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COLLECTION = 'connections';

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface ConnectionRecord {
  id: string;
  requester_uid: string;
  recipient_uid: string;
  participants: string[];
  requester_name?: string | null;
  recipient_name?: string | null;
  status: ConnectionStatus;
  created_at?: string;
  updated_at?: string;
}

const tsToIso = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as any)?.toDate === 'function') {
    try {
      return (v as any).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'string') return v;
  return undefined;
};

const docToConnection = (id: string, data: any): ConnectionRecord => ({
  id,
  requester_uid: data.requester_uid || '',
  recipient_uid: data.recipient_uid || '',
  participants: Array.isArray(data.participants) ? data.participants : [],
  requester_name: data.requester_name ?? null,
  recipient_name: data.recipient_name ?? null,
  status: (data.status as ConnectionStatus) || 'pending',
  created_at: tsToIso(data.created_at),
  updated_at: tsToIso(data.updated_at),
});

export interface CreateConnectionInput {
  requesterUid: string;
  requesterName?: string;
  recipientUid: string;
  recipientName?: string;
}

/** Send a connection request. The requester must be signed in (enforced by rules). */
export async function requestConnection(input: CreateConnectionInput): Promise<ConnectionRecord> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.requesterUid || !input.recipientUid) {
    throw new Error('Both requester and recipient are required.');
  }
  if (input.requesterUid === input.recipientUid) {
    throw new Error('You cannot connect with yourself.');
  }
  const payload = {
    requester_uid: input.requesterUid,
    recipient_uid: input.recipientUid,
    participants: [input.requesterUid, input.recipientUid],
    requester_name: input.requesterName ?? null,
    recipient_name: input.recipientName ?? null,
    status: 'pending' as ConnectionStatus,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return docToConnection(ref.id, { ...payload, created_at: new Date(), updated_at: new Date() });
}

/** Accept / decline a pending request (either party may update). */
export async function setConnectionStatus(
  connectionId: string,
  status: ConnectionStatus,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  await updateDoc(doc(db, COLLECTION, connectionId), {
    status,
    updated_at: serverTimestamp(),
  });
}

export async function removeConnection(connectionId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  await deleteDoc(doc(db, COLLECTION, connectionId));
}

/** All connections a user participates in (any status). Sorted newest first. */
export async function fetchConnectionsForUser(uid: string): Promise<ConnectionRecord[]> {
  if (!db || !uid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('participants', 'array-contains', uid)),
    );
    return snap.docs
      .map((d) => docToConnection(d.id, d.data()))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch (e) {
    console.warn('[connectionsService] fetchConnectionsForUser failed:', e);
    return [];
  }
}

/** Accepted connections only (what the "Connections" tile counts). */
export async function fetchAcceptedConnections(uid: string): Promise<ConnectionRecord[]> {
  const all = await fetchConnectionsForUser(uid);
  return all.filter((c) => c.status === 'accepted');
}

/** Platform-wide connection count (admin analytics). */
export async function countAllConnections(): Promise<number> {
  if (!db) return 0;
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.size;
  } catch (e) {
    console.warn('[connectionsService] countAllConnections failed:', e);
    return 0;
  }
}
