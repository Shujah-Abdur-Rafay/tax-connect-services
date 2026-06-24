// ============================================================================
// preparerNetworkService — Phase 4 Service Bureau preparer network (sub-accounts)
//
// A Service Bureau Partner (the "owner") runs a roster of preparers working
// under their office. Each roster entry is a doc in `preparer_network`:
//
//   owner_id        uid of the Service Bureau Partner
//   owner_name      display name (denormalized for listing)
//   preparer_email  invited preparer's email (the stable key before they link)
//   preparer_name   display name
//   preparer_uid    set once the preparer is linked to a platform account
//   role            'preparer' | 'manager'
//   status          'invited' | 'active' | 'removed'
//   invited_at / accepted_at / removed_at
//
// Reporting (ServiceBureauReport) aggregates gig-order production across the
// owner + any linked preparer uids.
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const PREPARER_NETWORK_COLLECTION = 'preparer_network';

export type NetworkRole = 'preparer' | 'manager';
export type NetworkStatus = 'invited' | 'active' | 'removed';

export interface NetworkMember {
  id: string;
  owner_id: string;
  owner_name?: string | null;
  preparer_email: string;
  preparer_name?: string | null;
  preparer_uid?: string | null;
  role: NetworkRole;
  status: NetworkStatus;
  invited_at?: string;
  accepted_at?: string | null;
  removed_at?: string | null;
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

const normalize = (id: string, raw: any): NetworkMember => ({
  id,
  owner_id: raw.owner_id || '',
  owner_name: raw.owner_name ?? null,
  preparer_email: (raw.preparer_email || '').toLowerCase(),
  preparer_name: raw.preparer_name ?? null,
  preparer_uid: raw.preparer_uid ?? null,
  role: (raw.role as NetworkRole) || 'preparer',
  status: (raw.status as NetworkStatus) || 'invited',
  invited_at: tsToIso(raw.invited_at),
  accepted_at: tsToIso(raw.accepted_at) ?? null,
  removed_at: tsToIso(raw.removed_at) ?? null,
});

/** Roster for an owner (excludes removed entries by default). */
export const getNetworkForOwner = async (
  ownerId: string,
  includeRemoved = false,
): Promise<NetworkMember[]> => {
  if (!db || !ownerId) return [];
  try {
    const snap = await getDocs(
      query(collection(db, PREPARER_NETWORK_COLLECTION), where('owner_id', '==', ownerId)),
    );
    const rows = snap.docs.map((d) => normalize(d.id, d.data()));
    const filtered = includeRemoved ? rows : rows.filter((r) => r.status !== 'removed');
    return filtered.sort((a, b) => (b.invited_at || '').localeCompare(a.invited_at || ''));
  } catch (e) {
    console.warn('[preparerNetworkService] getNetworkForOwner failed:', (e as Error).message);
    return [];
  }
};

/**
 * Invite a preparer into the owner's network by email. Idempotent on
 * (owner_id, preparer_email) — re-inviting an existing member returns it
 * instead of creating a duplicate.
 */
export const invitePreparer = async (input: {
  ownerId: string;
  ownerName?: string;
  email: string;
  name?: string;
  preparerUid?: string;
  role?: NetworkRole;
}): Promise<NetworkMember> => {
  if (!db) throw new Error('Firestore is not initialized');
  if (!input.ownerId) throw new Error('Missing owner.');
  const email = (input.email || '').trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }

  // Dedup: reuse an existing (non-removed) roster entry for this email.
  const existing = await getNetworkForOwner(input.ownerId, true);
  const match = existing.find((m) => m.preparer_email === email && m.status !== 'removed');
  if (match) return match;

  const ref = await addDoc(collection(db, PREPARER_NETWORK_COLLECTION), {
    owner_id: input.ownerId,
    owner_name: input.ownerName ?? null,
    preparer_email: email,
    preparer_name: input.name ?? null,
    preparer_uid: input.preparerUid ?? null,
    role: input.role || 'preparer',
    status: 'invited' as NetworkStatus,
    invited_at: serverTimestamp(),
    accepted_at: null,
    removed_at: null,
  });
  const snap = await getDoc(ref);
  return normalize(ref.id, snap.data() || {});
};

/** Owner action: mark a member active (e.g. after they confirm they're set up). */
export const activateMember = async (
  id: string,
  preparerUid?: string,
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  await updateDoc(doc(db, PREPARER_NETWORK_COLLECTION, id), {
    status: 'active' as NetworkStatus,
    ...(preparerUid ? { preparer_uid: preparerUid } : {}),
    accepted_at: serverTimestamp(),
  });
};

/** Owner action: link a platform uid to a roster entry (enables reporting). */
export const linkPreparerUid = async (id: string, preparerUid: string): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  await updateDoc(doc(db, PREPARER_NETWORK_COLLECTION, id), { preparer_uid: preparerUid });
};

/** Owner action: soft-remove a member from the roster. */
export const removeMember = async (id: string): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  await updateDoc(doc(db, PREPARER_NETWORK_COLLECTION, id), {
    status: 'removed' as NetworkStatus,
    removed_at: serverTimestamp(),
  });
};
