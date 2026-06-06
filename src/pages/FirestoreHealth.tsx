// =============================================================================
// /admin/firestore-health
// =============================================================================
// Live diagnostic for the Firestore SECURITY RULES deployment.
//
// Background: tax-pro onboarding shows the warning
//   "Saved on this device — we couldn't sync your profile to our servers just
//    yet (a temporary backend setting on our end)..."
// whenever a write to `professionals/{uid}` is rejected with
// permission-denied. firestore.rules ON DISK already allows the owner to
// write their own professional doc — so a permission-denied here means the
// DEPLOYED ruleset in the live project is STALE and needs a redeploy.
//
// This page proves it from inside the app:
//   1. Performs a real test WRITE to professionals/{currentUid} (a tiny
//      diagnostic field via setDoc(..., { merge: true })).
//   2. Performs a real test READ of that same doc.
//   3. Reports the EXACT result for each — success vs the precise
//      permission-denied / unauthenticated / other error code.
//   4. Renders copy-paste deploy commands (single + "copy all") plus a direct
//      link to the Firebase console rules page, so an admin can confirm and
//      fix the rules deployment without leaving the app.
//
// No server function is required — the checks run client-side as the signed-in
// admin, exercising the very same code path the onboarding form uses.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { doc, setDoc, getDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  PencilLine,
  BookOpen,
  ArrowRight,
  Copy,
  Check,
  Terminal,
  ClipboardList,
  LogIn,
} from 'lucide-react';

// ── Project + console constants ───────────────────────────────────────────────
const FIREBASE_PROJECT_ID =
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'refund-connect-1m30';

const CONSOLE_RULES_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/rules`;

// Exact remediation command sequence. firebase.json already wires
// firestore.rules, so a single deploy pushes the on-disk ruleset live.
const DEPLOY_COMMAND = `firebase deploy --only firestore:rules --project ${FIREBASE_PROJECT_ID}`;
const FIX_COMMANDS = [DEPLOY_COMMAND];

// ── Types ──────────────────────────────────────────────────────────────────────
type CheckStatus = 'idle' | 'running' | 'pass' | 'warn' | 'fail';

interface ProbeResult {
  status: CheckStatus;
  /** Firestore error code, e.g. "permission-denied", "unauthenticated". */
  code?: string;
  /** Raw human-readable error message from Firestore, verbatim. */
  message?: string;
  /** Round-trip latency in ms for a successful op. */
  latencyMs?: number;
  /** True when the failure is specifically a permission-denied (stale rules). */
  permissionDenied?: boolean;
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'running') {
    return (
      <Badge className="bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-100">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking…
      </Badge>
    );
  }
  if (status === 'pass') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Allowed
      </Badge>
    );
  }
  if (status === 'warn') {
    return (
      <Badge className="bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Warning
      </Badge>
    );
  }
  if (status === 'fail') {
    return (
      <Badge className="bg-red-100 text-red-800 border border-red-200 hover:bg-red-100">
        <XCircle className="h-3 w-3 mr-1" />
        Denied
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-slate-500">
      Idle
    </Badge>
  );
}

export default function FirestoreHealth() {
  const { user, firebaseUser, loading } = useAuth();
  const uid = firebaseUser?.uid || user?.uid || null;

  const [writeResult, setWriteResult] = useState<ProbeResult>({ status: 'idle' });
  const [readResult, setReadResult] = useState<ProbeResult>({ status: 'idle' });

  const docPath = uid ? `professionals/${uid}` : 'professionals/{uid}';

  // ── Run both probes against professionals/{uid} ───────────────────────────
  const runChecks = async () => {
    if (!uid || !db) return;

    setWriteResult({ status: 'running' });
    setReadResult({ status: 'idle' });

    const ref = doc(db, 'professionals', uid);

    // ── Test WRITE ──────────────────────────────────────────────────────────
    const startW = performance.now();
    try {
      // setDoc with merge mirrors exactly what the onboarding form does when it
      // syncs the professional profile. We write a single diagnostic field so
      // we never clobber a real profile, then clear it again on success.
      await setDoc(
        ref,
        {
          _firestoreHealthCheck: {
            at: Date.now(),
            by: uid,
            source: 'admin_firestore_health',
          },
        },
        { merge: true },
      );
      const latencyMs = Math.round(performance.now() - startW);
      setWriteResult({ status: 'pass', latencyMs });

      // Clean up the diagnostic field — best-effort, ignore failures.
      try {
        await setDoc(ref, { _firestoreHealthCheck: deleteField() }, { merge: true });
      } catch {
        /* leaving the tiny diagnostic field is harmless */
      }
    } catch (err: any) {
      const code = err?.code || 'unknown';
      const permissionDenied = code === 'permission-denied';
      setWriteResult({
        status: 'fail',
        code,
        message: err?.message || String(err),
        permissionDenied,
      });
    }

    // ── Test READ (run regardless of write outcome) ──────────────────────────
    setReadResult({ status: 'running' });
    const startR = performance.now();
    try {
      await getDoc(ref);
      const latencyMs = Math.round(performance.now() - startR);
      setReadResult({ status: 'pass', latencyMs });
    } catch (err: any) {
      const code = err?.code || 'unknown';
      const permissionDenied = code === 'permission-denied';
      setReadResult({
        status: 'fail',
        code,
        message: err?.message || String(err),
        permissionDenied,
      });
    }
  };

  useEffect(() => {
    // Auto-run once the auth state has resolved and we have a uid.
    if (!loading && uid) {
      runChecks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, uid]);

  const running =
    writeResult.status === 'running' || readResult.status === 'running';

  // Top-line verdict: the write is the one onboarding actually fails on.
  const overall: CheckStatus = useMemo(() => {
    if (!uid) return 'warn';
    if (running) return 'running';
    if (writeResult.status === 'fail' || readResult.status === 'fail')
      return 'fail';
    if (writeResult.status === 'pass' && readResult.status === 'pass')
      return 'pass';
    return 'idle';
  }, [uid, running, writeResult.status, readResult.status]);

  const stale =
    writeResult.permissionDenied || readResult.permissionDenied;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-2">
              Admin · Diagnostics
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Firestore rules health
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Confirms whether the <strong>deployed</strong> Firestore security
              rules let a signed-in owner write their own{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                professionals/&#123;uid&#125;
              </code>{' '}
              doc. A <code className="text-xs">permission-denied</code> here is
              the exact cause of the onboarding warning{' '}
              <em>"Saved on this device — we couldn't sync your profile"</em>,
              and means the live ruleset is stale.
            </p>
          </div>
          <Button
            onClick={runChecks}
            disabled={running || !uid}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Re-run checks
          </Button>
        </div>

        {/* ── Not signed in guard ────────────────────────────────────── */}
        {!loading && !uid && (
          <Alert className="mb-6">
            <LogIn className="h-4 w-4 text-amber-600" />
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>
              These checks run as the currently signed-in user, exercising the
              same rules path onboarding uses. Sign in (ideally as a tax-pro /
              admin account) and reload this page to run the write/read probes
              against <code className="text-xs">professionals/&#123;uid&#125;</code>.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Overall verdict ────────────────────────────────────────── */}
        <OverallBanner status={overall} stale={!!stale} hasUid={!!uid} />

        {/* ── Signed-in identity ─────────────────────────────────────── */}
        {uid && (
          <Card className="mb-5">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <InfoRow label="Signed-in UID" value={uid} />
                <InfoRow label="Email" value={user?.email || '—'} />
                <InfoRow
                  label="Target doc"
                  value={docPath}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Check 1: Test WRITE ────────────────────────────────────── */}
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <PencilLine className="h-5 w-5 text-blue-600" />
                1. Test write to professionals/&#123;uid&#125;
              </CardTitle>
              <StatusBadge status={writeResult.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Performs a real{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                setDoc(..., &#123; merge: true &#125;)
              </code>{' '}
              of a tiny diagnostic field — exactly what the onboarding profile
              sync does. The field is cleared again immediately on success, so
              no real data is touched.
            </p>

            {writeResult.status === 'pass' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <div className="font-semibold text-emerald-900">
                  Write ALLOWED · {writeResult.latencyMs}ms round-trip
                </div>
                <div className="text-emerald-800 mt-1">
                  The deployed rules let the owner write their own professional
                  doc. The onboarding sync warning should no longer appear for
                  this account.
                </div>
              </div>
            )}

            {writeResult.status === 'fail' && (
              <ProbeFailure result={writeResult} verb="write" />
            )}
          </CardContent>
        </Card>

        {/* ── Check 2: Test READ ─────────────────────────────────────── */}
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                2. Test read of professionals/&#123;uid&#125;
              </CardTitle>
              <StatusBadge status={readResult.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Performs a real{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                getDoc()
              </code>{' '}
              of the same doc to confirm read access is also intact.
            </p>

            {readResult.status === 'pass' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <div className="font-semibold text-emerald-900">
                  Read ALLOWED · {readResult.latencyMs}ms round-trip
                </div>
              </div>
            )}

            {readResult.status === 'fail' && (
              <ProbeFailure result={readResult} verb="read" />
            )}
          </CardContent>
        </Card>

        {/* ── Fix card: deploy commands + console link ───────────────── */}
        {(overall === 'fail' || stale) && (
          <Card className="mb-5 border-red-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                  Fix: redeploy your Firestore rules
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                {stale ? (
                  <>
                    Firestore rejected the operation with{' '}
                    <code className="text-xs bg-red-100 px-1 py-0.5 rounded text-red-800">
                      permission-denied
                    </code>{' '}
                    even though <code className="text-xs">firestore.rules</code>{' '}
                    on disk already allows the owner to write their own doc. That
                    means the <strong>deployed</strong> ruleset is stale.
                    Redeploy it:
                  </>
                ) : (
                  <>
                    The operation failed. Redeploy the latest{' '}
                    <code className="text-xs">firestore.rules</code> to the live
                    project, then re-run these checks:
                  </>
                )}
              </p>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-red-900">
                    Run this from your project root:
                  </p>
                  <CopyAllButton commands={FIX_COMMANDS} />
                </div>
                <CopyableCommand command={DEPLOY_COMMAND} />
                <p className="text-xs text-red-700">
                  When it finishes you'll see{' '}
                  <code className="bg-red-100 px-1 py-0.5 rounded">
                    Deploy complete!
                  </code>{' '}
                  — then click <strong>Re-run checks</strong> above to confirm
                  the write turns green.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  Prefer the console? Open the rules editor directly:
                </p>
                <a
                  href={CONSOLE_RULES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    Open Firebase Console · Firestore Rules
                    <ExternalLink className="h-3 w-3 ml-1.5" />
                  </Button>
                </a>
                <p className="text-xs text-slate-500 break-all">
                  {CONSOLE_RULES_URL}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Footer / quick links ───────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mt-8">
          <a href={CONSOLE_RULES_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Firestore Rules Console
              <ExternalLink className="h-3 w-3 ml-1.5" />
            </Button>
          </a>
          <a href="/admin/stripe-health">
            <Button variant="outline" size="sm">
              Stripe payment health
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
          </a>
          <a href="/onboarding">
            <Button variant="outline" size="sm">
              Tax-pro onboarding
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────
function OverallBanner({
  status,
  stale,
  hasUid,
}: {
  status: CheckStatus;
  stale: boolean;
  hasUid: boolean;
}) {
  if (!hasUid) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-600" />
        <div>
          <div className="font-semibold text-amber-900 text-lg">
            Sign in to run the rules probe.
          </div>
          <div className="text-sm text-amber-800">
            The checks need a signed-in UID to test{' '}
            <code className="text-xs">professionals/&#123;uid&#125;</code>.
          </div>
        </div>
      </div>
    );
  }
  if (status === 'running') {
    return (
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
        <div>
          <div className="font-semibold text-blue-900">
            Probing Firestore rules…
          </div>
          <div className="text-sm text-blue-800">
            Running a live write + read as the signed-in user.
          </div>
        </div>
      </div>
    );
  }
  if (status === 'pass') {
    return (
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        <div>
          <div className="font-semibold text-emerald-900 text-lg">
            Rules are deployed correctly.
          </div>
          <div className="text-sm text-emerald-800">
            The owner can both write and read their own professional doc.
            Onboarding profile sync will succeed — no "Saved on this device"
            warning.
          </div>
        </div>
      </div>
    );
  }
  if (status === 'fail') {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3">
        <XCircle className="h-6 w-6 text-red-600" />
        <div>
          <div className="font-semibold text-red-900 text-lg">
            {stale
              ? 'Deployed rules are STALE — profile sync is blocked.'
              : 'A rules probe failed.'}
          </div>
          <div className="text-sm text-red-800">
            {stale
              ? 'Firestore returned permission-denied. Redeploy firestore.rules (command below) to fix the onboarding sync warning.'
              : 'See the failing card below for the exact error code and message.'}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function ProbeFailure({
  result,
  verb,
}: {
  result: ProbeResult;
  verb: 'write' | 'read';
}) {
  return (
    <div className="space-y-2">
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>
          {result.permissionDenied
            ? `${verb === 'write' ? 'Write' : 'Read'} DENIED — permission-denied`
            : `${verb === 'write' ? 'Write' : 'Read'} failed`}
          {result.code ? ` (${result.code})` : ''}
        </AlertTitle>
        <AlertDescription className="whitespace-pre-wrap">
          {result.permissionDenied ? (
            <>
              Firestore rejected this {verb} with{' '}
              <code className="text-xs">permission-denied</code>. firestore.rules
              on disk allows the owner this {verb}, so the deployed ruleset is
              stale — redeploy it using the fix card below.
            </>
          ) : (
            <>Firestore error: {result.message}</>
          )}
        </AlertDescription>
      </Alert>
      <div className="rounded-md bg-slate-900 text-slate-100 px-3 py-2 font-mono text-xs overflow-x-auto">
        <span className="text-amber-400">code:</span>{' '}
        {result.code || 'unknown'}
        {result.message && (
          <>
            <br />
            <span className="text-amber-400">message:</span> {result.message}
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-xs text-slate-800 truncate ml-3">
        {value}
      </span>
    </div>
  );
}

// ── Inline terminal command with one-click copy ───────────────────────────────
function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await copyToClipboard(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 flex items-center gap-2 bg-slate-900 text-slate-100 rounded-md px-3 py-2 font-mono text-xs sm:text-sm overflow-x-auto">
        <Terminal className="h-4 w-4 shrink-0 text-emerald-400" />
        <code className="whitespace-pre">{command}</code>
      </div>
      <Button
        type="button"
        onClick={handleCopy}
        size="sm"
        variant="outline"
        aria-label="Copy command to clipboard"
        className={
          copied
            ? 'shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
            : 'shrink-0'
        }
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-1.5" />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}

// ── Clipboard helper (secure-context aware, with fallback) ────────────────────
async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch {
    /* clipboard blocked — command text remains visible for manual copy */
  }
}

// ── "Copy all fix commands" — single multi-line clipboard payload ─────────────
function CopyAllButton({ commands }: { commands: string[] }) {
  const [copied, setCopied] = useState(false);
  const payload = commands.join('\n');
  const handleCopy = async () => {
    await copyToClipboard(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      type="button"
      onClick={handleCopy}
      size="sm"
      variant="outline"
      aria-label="Copy all fix commands to clipboard"
      className={
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
          : 'border-red-300 bg-white text-red-700 hover:bg-red-50'
      }
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1.5" />
          Copied {commands.length} command{commands.length === 1 ? '' : 's'}!
        </>
      ) : (
        <>
          <ClipboardList className="h-4 w-4 mr-1.5" />
          Copy all fix commands
        </>
      )}
    </Button>
  );
}
