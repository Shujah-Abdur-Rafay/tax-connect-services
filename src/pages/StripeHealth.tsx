// =============================================================================
// /admin/stripe-health
// =============================================================================
// Real-time diagnostic page for the entire Stripe payment pipeline. Designed
// so the platform owner can spot a broken setup in SECONDS instead of weeks
// of mysteriously zero sales.
//
// Runs FOUR independent checks, each with its own green/red badge + exact
// error message:
//
//   1. VITE_STRIPE_PUBLISHABLE_KEY  (client-side env)
//        Verifies the env var is set and the value matches pk_live_ or pk_test_.
//
//   2. createTaxProPayment Cloud Function  (reachability + correctness)
//        POSTs a tiny $0.50 PaymentIntent to the Firebase function and checks
//        that a clientSecret comes back. The PI is left uncaptured — it just
//        proves the function is deployed and Stripe is reachable.
//
//   3. Webhook endpoint  (registered + receiving events)
//        Reads the last 10 events from Firestore `stripe_webhook_events`
//        (written by the stripeWebhook function on every signed event), so
//        the absence of recent events is a giant red flag.
//
//   4. Platform Connect account charges_enabled
//        Server-side hits stripe.accounts.retrieve() and surfaces
//        charges_enabled / payouts_enabled / requirements.
//
// All server-side work is in the `stripeHealth` Firebase Function. The page
// also queries the `createTaxProPayment` function directly for check #2.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
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
  KeyRound,
  Server,
  Webhook,
  Banknote,
  ArrowRight,
  Copy,
  Check,
  Terminal,
  ClipboardList,
} from 'lucide-react';

// ── Firebase function endpoints ──────────────────────────────────────────────
const FIREBASE_PROJECT_ID =
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'refund-connect-1m30';

const HEALTH_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/stripeHealth`;
const CREATE_PAYMENT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/createTaxProPayment`;
const WEBHOOK_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/stripeWebhook`;

// ── Types ────────────────────────────────────────────────────────────────────
type CheckStatus = 'idle' | 'running' | 'pass' | 'warn' | 'fail';

interface RecentEvent {
  eventId: string;
  type: string | null;
  createdAt: number | null;
  receivedAt: number | null;
  handled: boolean;
  livemode: boolean;
  objectId: string | null;
  objectType: string | null;
  amount: number | null;
  currency: string | null;
  handlerError: string | null;
}

interface ServerHealth {
  stripeSecretConfigured: boolean;
  stripeSecretMode: 'live' | 'test' | 'unknown' | null;
  webhookSecretConfigured: boolean;
  platformAccount: {
    ok: boolean;
    accountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    country: string | null;
    defaultCurrency: string | null;
    email: string | null;
    disabledReason: string | null;
    currentlyDue: string[];
    pastDue: string[];
    error?: string;
  };
  recentEvents: RecentEvent[];
  lastEventAt: number | null;
  totalEventsLogged: number;
  checkedAt: number;
}

// ── Reusable status badge ────────────────────────────────────────────────────
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
        Healthy
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
        Broken
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-slate-500">
      Idle
    </Badge>
  );
}

function relativeTime(ms: number | null | undefined): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return new Date(ms).toLocaleString();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export default function StripeHealth() {
  // ── Check 1: publishable key (purely client-side, runs instantly) ──────────
  const pubKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY as
    | string
    | undefined;
  const pubKeyTrimmed = (pubKey || '').trim();
  const pubKeyMode: 'live' | 'test' | 'invalid' | 'missing' = !pubKeyTrimmed
    ? 'missing'
    : pubKeyTrimmed.startsWith('pk_live_')
      ? 'live'
      : pubKeyTrimmed.startsWith('pk_test_')
        ? 'test'
        : 'invalid';
  const pubKeyStatus: CheckStatus =
    pubKeyMode === 'missing' || pubKeyMode === 'invalid' ? 'fail' : 'pass';
  const pubKeyError = useMemo(() => {
    if (pubKeyMode === 'missing') {
      return 'VITE_STRIPE_PUBLISHABLE_KEY is not set in the production build. Tax pros cannot enter their card — the Pricing dialog will refuse to load Stripe.js. Fix: add the publishable key to your hosting env vars (Vercel / Netlify / Firebase Hosting) and redeploy.';
    }
    if (pubKeyMode === 'invalid') {
      return `VITE_STRIPE_PUBLISHABLE_KEY is set but does NOT start with "pk_live_" or "pk_test_". The actual value starts with: "${pubKeyTrimmed.slice(0, 12)}…". Stripe.js will reject it.`;
    }
    return null;
  }, [pubKeyMode, pubKeyTrimmed]);

  // ── Check 2: createTaxProPayment reachability ──────────────────────────────
  const [backendStatus, setBackendStatus] = useState<CheckStatus>('idle');
  const [backendDetails, setBackendDetails] = useState<{
    paymentIntentId?: string;
    clientSecretPreview?: string;
    latencyMs?: number;
    error?: string;
    httpStatus?: number;
    // The exact Firebase Functions config key the createTaxProPayment function
    // reads for the Stripe secret (returned by the function on a 500 when the
    // secret isn't configured). Used to build the correct config:set command.
    configKey?: string;
  }>({});

  // ── Check 3/4: server-side health (webhook events + platform account) ──────
  const [serverStatus, setServerStatus] = useState<CheckStatus>('idle');
  const [server, setServer] = useState<ServerHealth | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // ── Run all checks ─────────────────────────────────────────────────────────
  const runAll = async () => {
    // We don't reset the publishable-key check — it's purely synchronous.
    setBackendStatus('running');
    setBackendDetails({});
    setServerStatus('running');
    setServer(null);
    setServerError(null);

    const checkBackend = async () => {
      try {
        const started = performance.now();
        const res = await fetch(CREATE_PAYMENT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flow: 'membership',
            amount: 50, // $0.50 — Stripe minimum
            currency: 'usd',
            email: 'stripe-health-check@refund-connect.com',
            name: 'Stripe Health Check',
            metadata: {
              source: 'admin_stripe_health_diagnostic',
              note: 'Diagnostic ping — PI is created but never confirmed.',
            },
          }),
        });
        const latencyMs = Math.round(performance.now() - started);
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          /* ignore parse */
        }
        if (!res.ok || !json?.clientSecret) {
          setBackendStatus('fail');
          setBackendDetails({
            httpStatus: res.status,
            latencyMs,
            // The function returns `configKey` (e.g. "stripe.secret") on a 500
            // when the Stripe secret isn't configured. Surface it so the fix
            // command below is always correct for THIS project's config key.
            configKey:
              typeof json?.configKey === 'string' ? json.configKey : undefined,
            error:
              json?.error ||
              `Function returned HTTP ${res.status} with no clientSecret. ` +
                (res.status === 404
                  ? 'The createTaxProPayment Cloud Function is NOT deployed. Run: firebase deploy --only functions:createTaxProPayment'
                  : res.status === 500
                    ? 'The function ran but Stripe rejected the call — check Stripe secret key is set on the server.'
                    : 'Unexpected response shape.'),
          });
          return;
        }
        setBackendStatus('pass');

        setBackendDetails({
          paymentIntentId: json.paymentIntentId,
          clientSecretPreview: String(json.clientSecret || '').slice(0, 18) + '…',
          latencyMs,
        });
      } catch (err: any) {
        setBackendStatus('fail');
        setBackendDetails({
          error:
            err?.message ||
            'Network error reaching the Cloud Function. Check your internet and the Firebase project id.',
        });
      }
    };

    const checkServer = async () => {
      try {
        const res = await fetch(HEALTH_URL, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          /* ignore */
        }
        if (!res.ok || !json?.success || !json?.server) {
          setServerStatus('fail');
          setServerError(
            json?.error ||
              `stripeHealth returned HTTP ${res.status}. ` +
                (res.status === 404
                  ? 'The stripeHealth Cloud Function is NOT deployed. Run: firebase deploy --only functions:stripeHealth'
                  : 'Unexpected response.'),
          );
          return;
        }
        setServer(json.server as ServerHealth);
        setServerStatus('pass');
      } catch (err: any) {
        setServerStatus('fail');
        setServerError(err?.message || 'Network error reaching stripeHealth.');
      }
    };

    await Promise.all([checkBackend(), checkServer()]);
  };

  useEffect(() => {
    // Auto-run on mount so the page is useful at a glance.
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived check statuses from server payload ─────────────────────────────
  const webhookStatus: CheckStatus = useMemo(() => {
    if (serverStatus === 'running') return 'running';
    if (serverStatus === 'fail' || !server) return 'fail';
    if (!server.webhookSecretConfigured) return 'fail';
    if (!server.recentEvents || server.recentEvents.length === 0) return 'warn';
    // If most recent event is older than 30 days, warn — could be a quiet site,
    // could be a broken endpoint. Owner needs to decide.
    if (
      server.lastEventAt &&
      Date.now() - server.lastEventAt > 30 * 24 * 60 * 60 * 1000
    ) {
      return 'warn';
    }
    return 'pass';
  }, [serverStatus, server]);

  const platformAccountStatus: CheckStatus = useMemo(() => {
    if (serverStatus === 'running') return 'running';
    if (serverStatus === 'fail' || !server) return 'fail';
    if (!server.stripeSecretConfigured) return 'fail';
    if (!server.platformAccount?.chargesEnabled) return 'fail';
    if (!server.platformAccount?.payoutsEnabled) return 'warn';
    if (
      (server.platformAccount.currentlyDue || []).length > 0 ||
      (server.platformAccount.pastDue || []).length > 0
    )
      return 'warn';
    return 'pass';
  }, [serverStatus, server]);

  // Top-line "Can tax pros pay right now?" verdict
  const overall: CheckStatus = useMemo(() => {
    const all = [pubKeyStatus, backendStatus, webhookStatus, platformAccountStatus];
    if (all.includes('running')) return 'running';
    if (all.includes('fail')) return 'fail';
    if (all.includes('warn')) return 'warn';
    return 'pass';
  }, [pubKeyStatus, backendStatus, webhookStatus, platformAccountStatus]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-2">
              Admin · Diagnostics
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900">
              Stripe payment health
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Four independent checks on the Stripe pipeline so you can spot a
              broken payment flow in seconds, not weeks. Re-run any time after
              changing env vars, redeploying a function, or rotating a webhook.
            </p>
          </div>
          <Button
            onClick={runAll}
            disabled={
              backendStatus === 'running' || serverStatus === 'running'
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {backendStatus === 'running' || serverStatus === 'running' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Re-run checks
          </Button>
        </div>

        {/* ── Overall verdict banner ────────────────────────────────── */}
        <OverallBanner status={overall} />

        {/* ── Check 1: Publishable key ──────────────────────────────── */}
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-600" />
                1. Frontend publishable key
              </CardTitle>
              <StatusBadge status={pubKeyStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Checks the browser-side <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code>{' '}
              is set and matches <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">pk_live_</code> or{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">pk_test_</code>. Without this, the inline
              card form on /pricing literally cannot render.
            </p>
            {pubKeyStatus === 'pass' ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <div className="font-semibold text-emerald-900">
                  Detected: <span className="uppercase">{pubKeyMode}</span> mode
                </div>
                <div className="text-emerald-800 mt-1 font-mono text-xs break-all">
                  {pubKeyTrimmed.slice(0, 14)}…{pubKeyTrimmed.slice(-4)}
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Publishable key broken</AlertTitle>
                <AlertDescription>{pubKeyError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* ── Check 2: createTaxProPayment reachable ─────────────────── */}
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-600" />
                2. createTaxProPayment Cloud Function
              </CardTitle>
              <StatusBadge status={backendStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Posts a tiny <strong>$0.50</strong> diagnostic PaymentIntent to{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded break-all">
                {CREATE_PAYMENT_URL}
              </code>{' '}
              and verifies a <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">clientSecret</code>{' '}
              comes back. The intent is created but never confirmed — no money moves.
            </p>
            {backendStatus === 'pass' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <div className="font-semibold text-emerald-900">
                  Function reachable · {backendDetails.latencyMs}ms round-trip
                </div>
                <div className="text-emerald-800 mt-1 font-mono text-xs break-all">
                  PI: {backendDetails.paymentIntentId}
                </div>
                <div className="text-emerald-700 mt-1 font-mono text-xs">
                  clientSecret: {backendDetails.clientSecretPreview}
                </div>
              </div>
            )}
            {backendStatus === 'fail' && (
              <>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>
                    Cloud Function broken
                    {backendDetails.httpStatus
                      ? ` (HTTP ${backendDetails.httpStatus})`
                      : ''}
                  </AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap">
                    {backendDetails.error}
                  </AlertDescription>
                </Alert>

                {/* When the function is simply NOT deployed (HTTP 404), surface
                    the exact deploy command with a one-click copy button so an
                    admin can fix it without leaving the page. */}
                {backendDetails.httpStatus === 404 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-red-900">
                        Fix: deploy the function. Run this from your project root:
                      </p>
                      <CopyAllButton
                        commands={['firebase deploy --only functions:createTaxProPayment']}
                      />
                    </div>
                    <CopyableCommand command="firebase deploy --only functions:createTaxProPayment" />
                    <p className="text-xs text-red-700">
                      After it finishes (you'll see “Deploy complete!”), click
                      <strong> Re-run checks</strong> above to confirm this card
                      turns green.
                    </p>
                  </div>
                )}


                {/* When the function IS deployed but the Stripe secret isn't
                    configured (HTTP 500), surface the two-line fix: set the
                    secret, then redeploy. Each line gets its own copy button. */}
                {backendDetails.httpStatus === 500 && (() => {
                  // The function reports the EXACT config key it reads (e.g.
                  // "stripe.secret"). Fall back to "stripe.secret" only if an
                  // older deploy didn't include `configKey` in its response.
                  const secretKey = backendDetails.configKey || 'stripe.secret';
                  return (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-red-900">
                          Fix: the function is deployed but Stripe's secret key
                          isn't configured. Set it, then redeploy — run these two
                          commands from your project root:
                        </p>
                        <CopyAllButton
                          commands={[
                            `firebase functions:config:set ${secretKey}="sk_live_..."`,
                            'firebase deploy --only functions:createTaxProPayment',
                          ]}
                        />
                      </div>

                      <p className="text-xs text-red-700">
                        The function reads its secret from the Firebase config key{' '}
                        <code className="bg-red-100 px-1 py-0.5 rounded">
                          {secretKey}
                        </code>
                        {backendDetails.configKey ? (
                          <span> (reported by this project's deployed function).</span>
                        ) : (
                          <span> (default — the deployed function didn't report a key).</span>
                        )}
                      </p>
                      <div>
                        <p className="text-xs font-medium text-red-800 mb-1.5">
                          1. Set your Stripe secret key (replace with your real{' '}
                          <code className="bg-red-100 px-1 py-0.5 rounded">
                            sk_live_…
                          </code>{' '}
                          key):
                        </p>
                        <CopyableCommand
                          command={`firebase functions:config:set ${secretKey}="sk_live_..."`}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-red-800 mb-1.5">
                          2. Redeploy the function so it picks up the new secret:
                        </p>
                        <CopyableCommand command="firebase deploy --only functions:createTaxProPayment" />
                      </div>
                      <p className="text-xs text-red-700">
                        Once both finish, click <strong>Re-run checks</strong>{' '}
                        above to confirm this card turns green.
                      </p>
                    </div>
                  );
                })()}

              </>
            )}
          </CardContent>
        </Card>

        {/* ── Check 3: Webhook events ───────────────────────────────── */}
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5 text-blue-600" />
                3. Webhook endpoint receiving events
              </CardTitle>
              <StatusBadge status={webhookStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Reads the last 10 events Stripe has signed and delivered to{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded break-all">
                {WEBHOOK_URL}
              </code>
              . Every signed event is mirrored into Firestore{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                stripe_webhook_events
              </code>{' '}
              the moment it arrives, so an empty list means Stripe is NOT calling
              your endpoint (wrong URL, deleted endpoint, or rotated secret).
            </p>

            {serverError && serverStatus === 'fail' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Could not load webhook log</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">
                  {serverError}
                </AlertDescription>
              </Alert>
            )}

            {server && !server.webhookSecretConfigured && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Webhook secret not configured</AlertTitle>
                  <AlertDescription>
                    <code className="text-xs">stripe.webhook_secret</code> is unset
                    on the server. Even if Stripe is hitting your endpoint, every
                    event fails signature verification.
                  </AlertDescription>
                </Alert>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-red-900">
                      Fix: set the webhook secret, then redeploy — run these two
                      commands from your project root:
                    </p>
                    <CopyAllButton
                      commands={[
                        'firebase functions:config:set stripe.webhook_secret="whsec_..."',
                        'firebase deploy --only functions:stripeWebhook',
                      ]}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-800 mb-1.5">
                      1. Set the signing secret (replace with your real{' '}
                      <code className="bg-red-100 px-1 py-0.5 rounded">
                        whsec_…
                      </code>{' '}
                      value):
                    </p>
                    <CopyableCommand command={'firebase functions:config:set stripe.webhook_secret="whsec_..."'} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-800 mb-1.5">
                      2. Redeploy the webhook so it picks up the new secret:
                    </p>
                    <CopyableCommand command="firebase deploy --only functions:stripeWebhook" />
                  </div>
                  <p className="text-xs text-red-700">
                    Once both finish, click <strong>Re-run checks</strong> above to
                    confirm this card turns green.
                  </p>
                </div>
              </div>
            )}


            {server &&
              server.webhookSecretConfigured &&
              server.recentEvents.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>No webhook events received yet</AlertTitle>
                  <AlertDescription>
                    The secret is configured, but Stripe has never delivered an
                    event to this endpoint. Either you haven't taken a payment
                    yet, or the endpoint isn't registered in the Stripe Dashboard.
                    Register it at{' '}
                    <a
                      href="https://dashboard.stripe.com/webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Stripe → Developers → Webhooks
                    </a>{' '}
                    with URL above and subscribe to at least{' '}
                    <code className="text-xs">payment_intent.succeeded</code> and{' '}
                    <code className="text-xs">payment_intent.payment_failed</code>.
                  </AlertDescription>
                </Alert>
              )}

            {server && server.recentEvents.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>
                    Last event{' '}
                    <strong className="text-slate-800">
                      {relativeTime(server.lastEventAt)}
                    </strong>{' '}
                    · {server.totalEventsLogged}
                    {server.totalEventsLogged >= 1000 ? '+' : ''} total logged
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-3 py-2">Type</th>
                        <th className="text-left px-3 py-2">Object</th>
                        <th className="text-left px-3 py-2">Mode</th>
                        <th className="text-left px-3 py-2">Received</th>
                        <th className="text-left px-3 py-2">Handler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {server.recentEvents.map((ev) => (
                        <tr
                          key={ev.eventId}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 font-mono text-xs">
                            {ev.type || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">
                            {ev.objectId
                              ? ev.objectId.slice(0, 14) + '…'
                              : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              className={
                                ev.livemode
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-100'
                              }
                            >
                              {ev.livemode ? 'live' : 'test'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {relativeTime(ev.receivedAt)}
                          </td>
                          <td className="px-3 py-2">
                            {ev.handled ? (
                              <span className="inline-flex items-center text-emerald-700 text-xs font-medium">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                handled
                              </span>
                            ) : ev.handlerError ? (
                              <span
                                className="inline-flex items-center text-red-700 text-xs font-medium"
                                title={ev.handlerError}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                error
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">
                                pending
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Check 4: Platform account charges_enabled ─────────────── */}
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Banknote className="h-5 w-5 text-blue-600" />
                4. Platform Stripe account · charges_enabled
              </CardTitle>
              <StatusBadge status={platformAccountStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Server-side retrieves <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">stripe.accounts.retrieve()</code>{' '}
              and surfaces the live capability flags. If{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">charges_enabled</code>{' '}
              is false, every membership PaymentIntent will be created but the
              charge itself will be blocked by Stripe.
            </p>

            {server?.platformAccount?.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Could not retrieve platform account</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">
                  {server.platformAccount.error}
                </AlertDescription>
              </Alert>
            )}

            {server && !server.platformAccount?.error && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <CapabilityRow
                  label="charges_enabled"
                  value={server.platformAccount.chargesEnabled}
                  blocking
                />
                <CapabilityRow
                  label="payouts_enabled"
                  value={server.platformAccount.payoutsEnabled}
                />
                <CapabilityRow
                  label="details_submitted"
                  value={server.platformAccount.detailsSubmitted}
                />
                <CapabilityRow
                  label={`secret key mode: ${server.stripeSecretMode || 'unknown'}`}
                  value={server.stripeSecretMode === 'live'}
                  warnOnFalse
                />
                <InfoRow
                  label="Account"
                  value={server.platformAccount.accountId || '—'}
                />
                <InfoRow
                  label="Country / currency"
                  value={`${server.platformAccount.country || '—'} · ${(
                    server.platformAccount.defaultCurrency || ''
                  ).toUpperCase()}`}
                />
              </div>
            )}

            {server &&
              (server.platformAccount?.currentlyDue?.length > 0 ||
                server.platformAccount?.pastDue?.length > 0) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>Stripe needs more info from you</AlertTitle>
                  <AlertDescription>
                    {server.platformAccount.pastDue?.length > 0 && (
                      <div className="mt-1">
                        <strong>Past due:</strong>{' '}
                        <code className="text-xs">
                          {server.platformAccount.pastDue.join(', ')}
                        </code>
                      </div>
                    )}
                    {server.platformAccount.currentlyDue?.length > 0 && (
                      <div className="mt-1">
                        <strong>Currently due:</strong>{' '}
                        <code className="text-xs">
                          {server.platformAccount.currentlyDue.join(', ')}
                        </code>
                      </div>
                    )}
                    {server.platformAccount.disabledReason && (
                      <div className="mt-1">
                        <strong>Reason:</strong>{' '}
                        {server.platformAccount.disabledReason}
                      </div>
                    )}
                    <a
                      href="https://dashboard.stripe.com/account/onboarding"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 underline mt-2"
                    >
                      Finish Stripe account onboarding
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>

        {/* ── Footer / quick links ──────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mt-8">
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              Stripe Dashboard
              <ExternalLink className="h-3 w-3 ml-1.5" />
            </Button>
          </a>
          <a
            href="https://dashboard.stripe.com/webhooks"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              Stripe Webhooks
              <ExternalLink className="h-3 w-3 ml-1.5" />
            </Button>
          </a>
          <a href="/admin/stripe-test">
            <Button variant="outline" size="sm">
              Run full Stripe test
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
          </a>
          <a href="/pricing">
            <Button variant="outline" size="sm">
              Go to Pricing (live checkout)
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
          </a>
        </div>

        {server?.checkedAt && (
          <p className="text-xs text-slate-400 mt-6">
            Server check completed at{' '}
            {new Date(server.checkedAt).toLocaleString()}.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────
function OverallBanner({ status }: { status: CheckStatus }) {
  if (status === 'running') {
    return (
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
        <div>
          <div className="font-semibold text-blue-900">
            Running diagnostic checks…
          </div>
          <div className="text-sm text-blue-800">
            This usually takes 1–2 seconds.
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
            Tax pros CAN pay right now.
          </div>
          <div className="text-sm text-emerald-800">
            All four checks pass — the publishable key is live, the Cloud
            Function is reachable, the webhook is firing, and the platform
            account has charges_enabled.
          </div>
        </div>
      </div>
    );
  }
  if (status === 'warn') {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-600" />
        <div>
          <div className="font-semibold text-amber-900 text-lg">
            Payments work — but there are warnings.
          </div>
          <div className="text-sm text-amber-800">
            Tax pros can pay, but at least one signal is off. Check the cards
            below for details.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3">
      <XCircle className="h-6 w-6 text-red-600" />
      <div>
        <div className="font-semibold text-red-900 text-lg">
          Tax pros CANNOT pay right now.
        </div>
        <div className="text-sm text-red-800">
          At least one check is failing. Fix the red cards below and re-run.
        </div>
      </div>
    </div>
  );
}

function CapabilityRow({
  label,
  value,
  blocking = false,
  warnOnFalse = false,
}: {
  label: string;
  value: boolean;
  blocking?: boolean;
  warnOnFalse?: boolean;
}) {
  const okClasses =
    'border-emerald-200 bg-emerald-50 text-emerald-900';
  const failClasses = blocking
    ? 'border-red-200 bg-red-50 text-red-900'
    : warnOnFalse
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-center justify-between text-sm ${
        value ? okClasses : failClasses
      }`}
    >
      <span className="font-mono">{label}</span>
      {value ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : blocking ? (
        <XCircle className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4" />
      )}
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

// ── Inline terminal command with one-click copy-to-clipboard ──────────────────
// Renders a dark code block + a "Copy" button. On click it copies the raw
// command to the clipboard and flips to a "Copied!" confirmation for 2s.
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

// ── Clipboard helper shared by CopyableCommand + CopyAllButton ────────────────
// Writes `text` to the clipboard, falling back to a hidden <textarea> +
// execCommand for non-secure contexts / older browsers. Swallows failures so
// the admin can always still select the visible command text manually.
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

// ── "Copy all fix commands" button ────────────────────────────────────────────
// Copies an ENTIRE remediation sequence as a single multi-line payload so an
// admin can paste every required command into their terminal at once. Each
// command lands on its own line, so a straight paste runs them in order.
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
