/**
 * CRM Sync Service
 * ---------------------------------------------------------------
 * Centralized service that pushes enrollees into the Famous CRM
 * with the four canonical enrollment levels:
 *
 *   - Directory Listing
 *   - Associate
 *   - Professional
 *   - Premier Partner
 *
 * Every sync attempt is also logged to the Firestore
 * `crm_sync_log` collection so the admin team can audit who was
 * pushed to the CRM and re-trigger a sync if needed.
 *
 * The Famous CRM subscribe endpoint accepts:
 *   { email, name?, phone?, source?, tags?, custom_fields? }
 *
 * We pass the enrollment level on BOTH `tags` (for segmentation
 * in the CRM UI) and `custom_fields.enrollment_level` (for a
 * single canonical field) so the project owner can filter by it.
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CRM_PROJECT_ID = '68a3939608e7f1e2bfd480c9';
const CRM_SUBSCRIBE_URL = `https://famous.ai/api/crm/${CRM_PROJECT_ID}/subscribe`;

export type EnrollmentLevel =
  | 'Directory Listing'
  | 'Associate'
  | 'Professional'
  | 'Premier Partner';

const VALID_LEVELS: EnrollmentLevel[] = [
  'Directory Listing',
  'Associate',
  'Professional',
  'Premier Partner',
];

/**
 * Map any internal / legacy tier string into one of the four
 * canonical CRM enrollment levels. Returns undefined if we can't
 * confidently match (caller decides whether to default).
 */
export function normalizeEnrollmentLevel(
  raw: string | undefined | null
): EnrollmentLevel | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();

  if (!s) return undefined;
  if (s.includes('premier') || s.includes('premium')) return 'Premier Partner';
  if (s.includes('professional')) return 'Professional';
  if (s.includes('associate') || s.includes('acquisition') || s.includes('entry'))
    return 'Associate';
  if (
    s.includes('directory') ||
    s === 'listing' ||
    s === 'free' ||
    s.includes('basic')
  )
    return 'Directory Listing';

  // Direct exact matches as a fallback
  const exact = VALID_LEVELS.find((l) => l.toLowerCase() === s);
  return exact;
}

/** Slugified tag form, used for CRM tags array. */
export function levelToTag(level: EnrollmentLevel): string {
  return level.toLowerCase().replace(/\s+/g, '-');
}

export interface CrmContactInput {
  email: string;
  name?: string;
  phone?: string;
  /** Internal enrollment level — will be normalized. */
  enrollmentLevel?: string;
  /** Where this contact came from (e.g. 'enrollment-application', 'membership-upgrade'). */
  source?: string;
  /** Extra free-form tags appended to the level tag. */
  extraTags?: string[];
  /** Optional foreign key to internal record (applicationId, userId, etc.). */
  internalId?: string;
}

export interface CrmSyncResult {
  ok: boolean;
  level?: EnrollmentLevel;
  error?: string;
  status?: number;
}

interface CrmSyncLogEntry {
  email: string;
  name?: string;
  phone?: string;
  level?: EnrollmentLevel;
  rawLevel?: string;
  source: string;
  tags: string[];
  internalId?: string;
  ok: boolean;
  error?: string;
  status?: number;
  syncedAt: Timestamp | ReturnType<typeof serverTimestamp>;
}

const SYNC_LOG_COLLECTION = 'crm_sync_log';

/**
 * Push a contact into the Famous CRM and log the result.
 * Never throws — returns { ok: false, error } on failure so
 * callers (signup, checkout) can keep going on CRM outages.
 */
export async function syncContactToCrm(
  input: CrmContactInput
): Promise<CrmSyncResult> {
  const email = (input.email || '').trim().toLowerCase();
  if (!email) {
    return { ok: false, error: 'Missing email' };
  }

  const level = normalizeEnrollmentLevel(input.enrollmentLevel);
  const source = input.source || 'enrollment';
  const tags: string[] = ['enrollee'];
  if (level) {
    tags.push(levelToTag(level));
    tags.push('membership-level');
  }
  if (input.extraTags) {
    for (const t of input.extraTags) {
      if (t && !tags.includes(t)) tags.push(t);
    }
  }

  const body: Record<string, unknown> = {
    email,
    source,
    tags,
    custom_fields: {
      enrollment_level: level || 'Unknown',
      phone: input.phone || '',
      internal_id: input.internalId || '',
    },
  };
  if (input.name && input.name.trim()) body.name = input.name.trim();
  if (input.phone && input.phone.trim()) body.phone = input.phone.trim();

  let ok = false;
  let status: number | undefined;
  let error: string | undefined;

  try {
    const res = await fetch(CRM_SUBSCRIBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    status = res.status;
    ok = res.ok;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      error = `CRM responded ${res.status}: ${text.slice(0, 200)}`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
    ok = false;
  }

  // Log every attempt (non-blocking). Use both addDoc (history) and
  // setDoc on a deterministic key keyed by email+level (latest state)
  // so the admin page can de-dupe quickly.
  const logPayload: CrmSyncLogEntry = {
    email,
    name: input.name,
    phone: input.phone,
    level,
    rawLevel: input.enrollmentLevel,
    source,
    tags,
    internalId: input.internalId,
    ok,
    error,
    status,
    syncedAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, SYNC_LOG_COLLECTION), logPayload);
  } catch (logErr) {
    console.warn('CRM sync log (addDoc) failed:', logErr);
  }

  // Also upsert a "latest" doc per email so the admin page can show
  // the current enrollment level without scanning the entire history.
  try {
    const safeKey = email.replace(/[^a-z0-9]+/gi, '_');
    await setDoc(
      doc(db, 'crm_contacts', safeKey),
      {
        email,
        name: input.name || '',
        phone: input.phone || '',
        level: level || 'Unknown',
        source,
        tags,
        internalId: input.internalId || '',
        lastSyncOk: ok,
        lastSyncError: error || '',
        lastSyncStatus: status || null,
        lastSyncedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (upsertErr) {
    console.warn('CRM contact upsert failed:', upsertErr);
  }

  return { ok, level, error, status };
}

/** Convenience: re-sync from the admin page. */
export async function resyncContact(
  input: CrmContactInput
): Promise<CrmSyncResult> {
  return syncContactToCrm({ ...input, source: input.source || 'admin-resync' });
}

// ---------------------------------------------------------------
// Admin: list / read CRM contacts and history
// ---------------------------------------------------------------

export interface CrmContact {
  id: string;
  email: string;
  name: string;
  phone: string;
  level: EnrollmentLevel | 'Unknown';
  source: string;
  tags: string[];
  internalId: string;
  lastSyncOk: boolean;
  lastSyncError?: string;
  lastSyncStatus?: number | null;
  lastSyncedAt?: Date | null;
}

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  const maybe = v as { toDate?: () => Date };
  if (maybe && typeof maybe.toDate === 'function') return maybe.toDate();
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export async function fetchCrmContacts(): Promise<CrmContact[]> {
  try {
    const q = query(
      collection(db, 'crm_contacts'),
      orderBy('lastSyncedAt', 'desc'),
      limit(500)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: String(raw.email || ''),
        name: String(raw.name || ''),
        phone: String(raw.phone || ''),
        level:
          (raw.level as CrmContact['level']) ||
          ('Unknown' as CrmContact['level']),
        source: String(raw.source || ''),
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
        internalId: String(raw.internalId || ''),
        lastSyncOk: raw.lastSyncOk !== false,
        lastSyncError: (raw.lastSyncError as string) || '',
        lastSyncStatus:
          typeof raw.lastSyncStatus === 'number'
            ? (raw.lastSyncStatus as number)
            : null,
        lastSyncedAt: toDate(raw.lastSyncedAt),
      };
    });
  } catch (err) {
    console.warn('fetchCrmContacts failed:', err);
    return [];
  }
}

export interface CrmSyncHistoryEntry {
  id: string;
  email: string;
  level?: EnrollmentLevel;
  rawLevel?: string;
  source: string;
  ok: boolean;
  error?: string;
  status?: number;
  syncedAt: Date | null;
}

export async function fetchCrmSyncHistory(
  email?: string,
  max = 50
): Promise<CrmSyncHistoryEntry[]> {
  try {
    const q = email
      ? query(
          collection(db, SYNC_LOG_COLLECTION),
          where('email', '==', email.trim().toLowerCase()),
          orderBy('syncedAt', 'desc'),
          limit(max)
        )
      : query(
          collection(db, SYNC_LOG_COLLECTION),
          orderBy('syncedAt', 'desc'),
          limit(max)
        );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: String(raw.email || ''),
        level: raw.level as EnrollmentLevel | undefined,
        rawLevel: raw.rawLevel as string | undefined,
        source: String(raw.source || ''),
        ok: raw.ok !== false,
        error: (raw.error as string) || undefined,
        status:
          typeof raw.status === 'number' ? (raw.status as number) : undefined,
        syncedAt: toDate(raw.syncedAt),
      };
    });
  } catch (err) {
    console.warn('fetchCrmSyncHistory failed:', err);
    return [];
  }
}
