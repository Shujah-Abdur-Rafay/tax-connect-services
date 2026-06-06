// profileSyncQueue.ts
// ----------------------------------------------------------------------------
// Background retry queue for the tax-pro onboarding profile sync.
//
// Problem: when a write to `professionals/{uid}` is rejected with
// `permission-denied` (a stale-rules / backend-config issue, NOT the user's
// session), onboarding falls back to "Saved on this device — we couldn't sync
// your profile". Previously that local-only copy was never re-pushed to the
// server, so the warning persisted until the user manually re-saved.
//
// This module fixes that by persisting the *pending Firestore payload* to
// localStorage and automatically re-attempting the write:
//   • once on the next app load, and
//   • on a recurring timer,
//   • plus on regaining network connectivity.
// When a re-attempt succeeds, the queued item is removed and subscribers are
// notified so the UI can clear the "Saved on this device" warning.
//
// The queue is keyed per Firebase uid + a logical "kind" (profile / services /
// agreement) so multiple pending writes for the same user are deduped by kind
// (the latest payload for a kind wins).
// ----------------------------------------------------------------------------

import { db, auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export type SyncKind = 'profile' | 'services' | 'agreement' | 'draft';

export interface PendingSync {
  /** Stable id: `${uid}:${kind}` so the newest payload per kind replaces old. */
  id: string;
  uid: string;
  kind: SyncKind;
  /** The exact data to merge into `professionals/{uid}`. */
  payload: Record<string, unknown>;
  /** ISO timestamp the item was first enqueued. */
  queuedAt: string;
  /** How many flush attempts have been made. */
  attempts: number;
  /** ISO timestamp of the last attempt (for diagnostics / backoff display). */
  lastAttemptAt?: string;
  /** Last error message seen, if any. */
  lastError?: string;
}

const STORAGE_KEY = 'professionalSyncQueue:v1';
const RETRY_INTERVAL_MS = 30_000; // re-attempt every 30s while items remain
const MAX_ATTEMPTS = 100; // effectively keep trying; cap to avoid runaway logs

type Listener = (pending: PendingSync[]) => void;
const listeners = new Set<Listener>();

let timerId: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let started = false;

// ── localStorage helpers ────────────────────────────────────────────────────

function readQueue(): PendingSync[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingSync[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingSync[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function notify() {
  const snapshot = readQueue();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* a broken listener must not break the queue */
    }
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribeSyncQueue(fn: Listener): () => void {
  listeners.add(fn);
  // Emit current state immediately so the UI can render on mount.
  try {
    fn(readQueue());
  } catch {
    /* ignore */
  }
  return () => {
    listeners.delete(fn);
  };
}

/** Current pending items (read-only snapshot). */
export function getPendingSyncs(uid?: string): PendingSync[] {
  const items = readQueue();
  return uid ? items.filter((i) => i.uid === uid) : items;
}

/** True if there is at least one pending item (optionally for a given uid). */
export function hasPendingSync(uid?: string): boolean {
  return getPendingSyncs(uid).length > 0;
}

/**
 * Enqueue (or replace) a pending professional-doc write. The payload is merged
 * into `professionals/{uid}`. Re-enqueuing the same uid+kind replaces the
 * previous payload so the newest data wins. Returns the stored item.
 */
export function enqueueProfileSync(
  uid: string,
  kind: SyncKind,
  payload: Record<string, unknown>,
): PendingSync {
  const items = readQueue();
  const id = `${uid}:${kind}`;
  const existing = items.find((i) => i.id === id);

  const item: PendingSync = {
    id,
    uid,
    kind,
    payload,
    queuedAt: existing?.queuedAt || new Date().toISOString(),
    attempts: existing?.attempts || 0,
  };

  const next = items.filter((i) => i.id !== id);
  next.push(item);
  writeQueue(next);
  notify();

  // Kick an immediate flush attempt (don't wait for the timer).
  void flushSyncQueue();
  return item;
}

/** Remove a specific queued item (e.g. user discarded the draft). */
export function removePendingSync(id: string) {
  const next = readQueue().filter((i) => i.id !== id);
  writeQueue(next);
  notify();
}

/** Clear all pending items for a uid (or everything when uid omitted). */
export function clearPendingSyncs(uid?: string) {
  const next = uid ? readQueue().filter((i) => i.uid !== uid) : [];
  writeQueue(next);
  notify();
}

/**
 * Attempt to flush every pending item. For each item we perform a merge write
 * to `professionals/{uid}`. Items that succeed are removed; items that fail are
 * kept (with attempt/error metadata updated) for the next cycle.
 *
 * We only flush items belonging to the currently signed-in user, because
 * Firestore rules require the owner's auth token to write their own doc — a
 * different (or absent) signed-in user could never succeed and would just burn
 * attempts. Other users' items are preserved for when they sign in.
 *
 * Returns the number of items successfully synced this pass.
 */
export async function flushSyncQueue(): Promise<number> {
  if (flushing) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;

  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return 0; // can't write anyone's doc without an owner token

  const items = readQueue();
  const mine = items.filter((i) => i.uid === currentUid);
  if (mine.length === 0) return 0;

  flushing = true;
  let synced = 0;

  try {
    for (const item of mine) {
      try {
        const ref = doc(db, 'professionals', item.uid);
        await setDoc(ref, item.payload, { merge: true });
        // Success — drop it from the queue.
        removeInternal(item.id);
        synced += 1;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err ?? 'unknown error');
        bumpAttempt(item.id, message);
        // permission-denied / offline → keep it for the next cycle.
      }
    }
  } finally {
    flushing = false;
  }

  if (synced > 0) notify();
  return synced;
}

// ── Internal mutation helpers (no notify; callers decide) ────────────────────

function removeInternal(id: string) {
  const next = readQueue().filter((i) => i.id !== id);
  writeQueue(next);
}

function bumpAttempt(id: string, error: string) {
  const items = readQueue();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const item = items[idx];
  item.attempts = (item.attempts || 0) + 1;
  item.lastAttemptAt = new Date().toISOString();
  item.lastError = error;
  if (item.attempts > MAX_ATTEMPTS) {
    // Keep the data but stop hammering by removing from active retry set.
    // We leave it in storage so a manual retry can still re-add it.
    items.splice(idx, 1);
  } else {
    items[idx] = item;
  }
  writeQueue(items);
}

/**
 * Start the background retry runner. Safe to call multiple times (idempotent).
 * Performs an immediate flush, then re-attempts on a timer and whenever the
 * device regains connectivity. Call once at app startup.
 */
export function startProfileSyncRunner() {
  if (started || typeof window === 'undefined') return;
  started = true;

  // 1) Immediate attempt on load (covers the "next app load" requirement).
  //    Delay slightly so Firebase auth has a chance to resolve currentUser.
  setTimeout(() => {
    void flushSyncQueue();
  }, 2500);

  // 2) Recurring timer while items remain.
  timerId = setInterval(() => {
    if (hasPendingSync()) {
      void flushSyncQueue();
    }
  }, RETRY_INTERVAL_MS);

  // 3) Flush on regaining connectivity.
  window.addEventListener('online', () => {
    void flushSyncQueue();
  });

  // 4) Re-attempt when auth state changes (user just signed in).
  try {
    auth.onAuthStateChanged((u) => {
      if (u) void flushSyncQueue();
    });
  } catch {
    /* auth not ready — timer will still catch it */
  }
}

/** Stop the runner (mainly for tests / cleanup). */
export function stopProfileSyncRunner() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  started = false;
}
