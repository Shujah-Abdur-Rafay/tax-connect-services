/**
 * Broadcast Service
 * ---------------------------------------------------------------
 * Powers the admin email-blast tool at /admin/crm-broadcast.
 *
 * Responsibilities:
 *   1. Resolve a recipient list from `crm_contacts` by enrollment level
 *      (Directory Listing / Associate / Professional / Premier Partner).
 *   2. Send each email via the existing `send-notification-email`
 *      Supabase edge function using `type: 'broadcast'` (raw subject +
 *      html). Sends are processed in batches of BATCH_SIZE (default 50)
 *      with all sends in a batch fired in parallel, then the next batch
 *      starts.
 *   3. Track per-recipient delivery status in the Firestore
 *      `broadcast_log` collection so the admin can audit who got the
 *      email, who errored, and re-send to just the failures.
 *
 * Firestore schema:
 *   broadcast_log/{broadcastId}                  – summary doc
 *     - subject, htmlBody, plainPreview, levels, totalRecipients,
 *       successCount, failureCount, status, createdBy, createdAt,
 *       startedAt, completedAt
 *   broadcast_log/{broadcastId}/recipients/{i}   – per-recipient row
 *     - email, name, level, status: 'pending'|'sent'|'failed',
 *       error?, attemptedAt, completedAt
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import type { EnrollmentLevel } from './crmSyncService';

export const BROADCAST_BATCH_SIZE = 50;

export type BroadcastStatus = 'pending' | 'sending' | 'completed' | 'failed';
export type RecipientStatus = 'pending' | 'sent' | 'failed';

export interface BroadcastRecipient {
  email: string;
  name?: string;
  level: EnrollmentLevel | 'Unknown';
}

export interface BroadcastSummary {
  id: string;
  subject: string;
  htmlBody: string;
  levels: string[];
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  status: BroadcastStatus;
  createdBy?: string;
  createdAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface BroadcastRecipientRecord {
  id: string;
  email: string;
  name: string;
  level: EnrollmentLevel | 'Unknown';
  status: RecipientStatus;
  error?: string;
  attemptedAt: Date | null;
  completedAt: Date | null;
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

/** Strip HTML tags for a quick plain-text preview snippet in summary docs. */
function plainPreview(html: string, max = 200): string {
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > max ? stripped.slice(0, max) + '…' : stripped;
}

/**
 * Send a single broadcast email via the existing edge function.
 * Never throws — returns {ok,error} so the batch loop can keep going
 * and the failure is logged per-recipient.
 */
async function sendSingleBroadcast(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'send-notification-email',
      {
        body: {
          type: 'broadcast',
          recipientEmail,
          recipientName,
          subject,
          html,
        },
      }
    );

    if (error) {
      return { ok: false, error: error.message || 'Edge function error' };
    }
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      return {
        ok: false,
        error: (data as { error?: string }).error || 'Edge function reported failure',
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: e instanceof Error ? false : false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export interface StartBroadcastInput {
  subject: string;
  html: string;
  levels: EnrollmentLevel[];
  recipients: BroadcastRecipient[];
  createdBy?: string;
}

export interface BroadcastProgress {
  total: number;
  sent: number;
  failed: number;
  inFlight: number;
  currentBatch: number;
  totalBatches: number;
}

/**
 * Run an end-to-end broadcast: create the summary doc, pre-create all
 * recipient docs as 'pending', then send in batches of BROADCAST_BATCH_SIZE.
 * Each completed recipient updates its row in Firestore.
 */
export async function startBroadcast(
  input: StartBroadcastInput,
  onProgress?: (progress: BroadcastProgress) => void
): Promise<{ broadcastId: string; successCount: number; failureCount: number }> {
  const recipients = input.recipients.filter(
    (r) => r.email && r.email.includes('@')
  );
  const totalBatches = Math.ceil(recipients.length / BROADCAST_BATCH_SIZE);

  // 1) Create the summary doc
  const summaryRef = await addDoc(collection(db, 'broadcast_log'), {
    subject: input.subject,
    htmlBody: input.html,
    plainPreview: plainPreview(input.html),
    levels: input.levels,
    totalRecipients: recipients.length,
    successCount: 0,
    failureCount: 0,
    status: 'sending' as BroadcastStatus,
    createdBy: input.createdBy || '',
    createdAt: serverTimestamp(),
    startedAt: serverTimestamp(),
    completedAt: null,
  });

  // 2) Pre-create all recipient docs as 'pending' (parallel writes)
  const recipientRefs = await Promise.all(
    recipients.map(async (r) => {
      const ref = await addDoc(
        collection(db, 'broadcast_log', summaryRef.id, 'recipients'),
        {
          email: r.email.trim().toLowerCase(),
          name: r.name || '',
          level: r.level,
          status: 'pending' as RecipientStatus,
          attemptedAt: null,
          completedAt: null,
        }
      );
      return { ref, recipient: r };
    })
  );

  let successCount = 0;
  let failureCount = 0;

  // 3) Send in batches of BROADCAST_BATCH_SIZE, parallel inside each batch
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * BROADCAST_BATCH_SIZE;
    const slice = recipientRefs.slice(start, start + BROADCAST_BATCH_SIZE);

    onProgress?.({
      total: recipients.length,
      sent: successCount,
      failed: failureCount,
      inFlight: slice.length,
      currentBatch: batchIdx + 1,
      totalBatches,
    });

    await Promise.all(
      slice.map(async ({ ref, recipient }) => {
        // Mark as in-flight
        try {
          await updateDoc(ref, { attemptedAt: serverTimestamp() });
        } catch (e) {
          console.warn('failed to mark attemptedAt', e);
        }

        const result = await sendSingleBroadcast(
          recipient.email,
          recipient.name || '',
          input.subject,
          input.html
        );

        if (result.ok) {
          successCount++;
          try {
            await updateDoc(ref, {
              status: 'sent' as RecipientStatus,
              completedAt: serverTimestamp(),
              error: '',
            });
          } catch (e) {
            console.warn('failed to mark sent', e);
          }
        } else {
          failureCount++;
          try {
            await updateDoc(ref, {
              status: 'failed' as RecipientStatus,
              completedAt: serverTimestamp(),
              error: result.error || 'Unknown error',
            });
          } catch (e) {
            console.warn('failed to mark failed', e);
          }
        }
      })
    );

    onProgress?.({
      total: recipients.length,
      sent: successCount,
      failed: failureCount,
      inFlight: 0,
      currentBatch: batchIdx + 1,
      totalBatches,
    });
  }

  // 4) Finalize summary doc
  try {
    await updateDoc(doc(db, 'broadcast_log', summaryRef.id), {
      successCount,
      failureCount,
      status: failureCount === recipients.length && recipients.length > 0
        ? ('failed' as BroadcastStatus)
        : ('completed' as BroadcastStatus),
      completedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('failed to finalize broadcast summary', e);
  }

  return {
    broadcastId: summaryRef.id,
    successCount,
    failureCount,
  };
}

/** List recent broadcasts for the admin history table. */
export async function fetchRecentBroadcasts(max = 25): Promise<BroadcastSummary[]> {
  try {
    const q = query(
      collection(db, 'broadcast_log'),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        subject: String(raw.subject || ''),
        htmlBody: String(raw.htmlBody || ''),
        levels: Array.isArray(raw.levels) ? (raw.levels as string[]) : [],
        totalRecipients: Number(raw.totalRecipients || 0),
        successCount: Number(raw.successCount || 0),
        failureCount: Number(raw.failureCount || 0),
        status: (raw.status as BroadcastStatus) || 'pending',
        createdBy: (raw.createdBy as string) || '',
        createdAt: toDate(raw.createdAt),
        startedAt: toDate(raw.startedAt),
        completedAt: toDate(raw.completedAt),
      };
    });
  } catch (err) {
    console.warn('fetchRecentBroadcasts failed:', err);
    return [];
  }
}

export async function fetchBroadcastRecipients(
  broadcastId: string
): Promise<BroadcastRecipientRecord[]> {
  try {
    const snap = await getDocs(
      collection(db, 'broadcast_log', broadcastId, 'recipients')
    );
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: String(raw.email || ''),
        name: String(raw.name || ''),
        level: (raw.level as BroadcastRecipientRecord['level']) || 'Unknown',
        status: (raw.status as RecipientStatus) || 'pending',
        error: (raw.error as string) || '',
        attemptedAt: toDate(raw.attemptedAt),
        completedAt: toDate(raw.completedAt),
      };
    });
  } catch (err) {
    console.warn('fetchBroadcastRecipients failed:', err);
    return [];
  }
}

export async function fetchBroadcastSummary(
  broadcastId: string
): Promise<BroadcastSummary | null> {
  try {
    const ref = doc(db, 'broadcast_log', broadcastId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    return {
      id: snap.id,
      subject: String(raw.subject || ''),
      htmlBody: String(raw.htmlBody || ''),
      levels: Array.isArray(raw.levels) ? (raw.levels as string[]) : [],
      totalRecipients: Number(raw.totalRecipients || 0),
      successCount: Number(raw.successCount || 0),
      failureCount: Number(raw.failureCount || 0),
      status: (raw.status as BroadcastStatus) || 'pending',
      createdBy: (raw.createdBy as string) || '',
      createdAt: toDate(raw.createdAt),
      startedAt: toDate(raw.startedAt),
      completedAt: toDate(raw.completedAt),
    };
  } catch (err) {
    console.warn('fetchBroadcastSummary failed:', err);
    return null;
  }
}

// Re-export so callers can `import { setDoc }` if they need to fix orphan docs.
export { setDoc };
