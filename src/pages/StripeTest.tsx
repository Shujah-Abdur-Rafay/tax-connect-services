import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, ExternalLink, ArrowLeft } from "lucide-react";
import { stripePromise, STRIPE_IS_CONFIGURED } from "@/lib/stripe";

const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  "refund-connect-1m30";

const CREATE_PAYMENT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/createTaxProPayment`;
const WEBHOOK_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/stripeWebhook`;

type Status = "idle" | "running" | "pass" | "fail";

interface TestResult {
  status: Status;
  message?: string;
  details?: string;
}

const StatusBadge = ({ status }: { status: Status }) => {
  if (status === "pass")
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Passed
      </Badge>
    );
  if (status === "fail")
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        <XCircle className="w-3.5 h-3.5 mr-1" /> Failed
      </Badge>
    );
  if (status === "running")
    return (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Running
      </Badge>
    );
  return <Badge variant="outline">Not run</Badge>;
};

const StripeTest = () => {
  const [frontendTest, setFrontendTest] = useState<TestResult>({ status: "idle" });
  const [stripeJsTest, setStripeJsTest] = useState<TestResult>({ status: "idle" });
  const [backendTest, setBackendTest] = useState<TestResult>({ status: "idle" });
  const [running, setRunning] = useState(false);

  const pubKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  const keyMode = pubKey?.startsWith("pk_live_")
    ? "LIVE"
    : pubKey?.startsWith("pk_test_")
    ? "TEST"
    : "UNKNOWN";

  const runTest1 = async () => {
    setFrontendTest({ status: "running" });
    await new Promise((r) => setTimeout(r, 400));
    if (!STRIPE_IS_CONFIGURED) {
      setFrontendTest({
        status: "fail",
        message: "Publishable key missing or invalid",
        details:
          "Add VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_...) to your .env file and rebuild the app.",
      });
      return false;
    }
    setFrontendTest({
      status: "pass",
      message: `Publishable key detected (${keyMode} mode)`,
      details: `Key prefix: ${pubKey?.substring(0, 12)}...`,
    });
    return true;
  };

  const runTest2 = async () => {
    setStripeJsTest({ status: "running" });
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        setStripeJsTest({
          status: "fail",
          message: "Stripe.js failed to load",
          details: "The publishable key may be invalid or the Stripe CDN is unreachable.",
        });
        return false;
      }
      setStripeJsTest({
        status: "pass",
        message: "Stripe.js loaded successfully",
        details: "The Stripe Elements SDK is ready to render payment forms.",
      });
      return true;
    } catch (err: any) {
      setStripeJsTest({
        status: "fail",
        message: "Error loading Stripe.js",
        details: err?.message || "Unknown error",
      });
      return false;
    }
  };

  const runTest3 = async () => {
    setBackendTest({ status: "running" });
    try {
      const response = await fetch(CREATE_PAYMENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 100, // $1.00 test amount
          currency: "usd",
          email: "stripe-test@refund-connect.com",
          name: "Stripe Integration Test",
          membershipTier: "test",
          metadata: { test_run: "true", source: "stripe_test_page" },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = data?.error || `HTTP ${response.status}`;
        let hint = "";
        if (errMsg.includes("not configured")) {
          hint =
            " → Run: firebase functions:config:set stripe.secret=\"sk_live_...\" && firebase deploy --only functions";
        } else if (response.status === 404) {
          hint =
            " → The function isn't deployed. Run: firebase deploy --only functions:createTaxProPayment";
        }
        setBackendTest({
          status: "fail",
          message: `Backend error: ${errMsg}${hint}`,
          details: JSON.stringify(data, null, 2),
        });
        return false;
      }

      if (data?.success && data?.clientSecret) {
        setBackendTest({
          status: "pass",
          message: "Backend created a test PaymentIntent successfully",
          details: `PaymentIntent ID: ${data.paymentIntentId}\nAmount: $${(
            data.amount / 100
          ).toFixed(2)} ${data.currency.toUpperCase()}\nclient_secret: ${data.clientSecret.substring(
            0,
            30
          )}...`,
        });
        return true;
      }

      setBackendTest({
        status: "fail",
        message: "Backend responded but did not return a clientSecret",
        details: JSON.stringify(data, null, 2),
      });
      return false;
    } catch (err: any) {
      setBackendTest({
        status: "fail",
        message: "Could not reach the Cloud Function",
        details: `${err?.message || err}\n\nMake sure the function is deployed:\n  firebase deploy --only functions\n\nFunction URL: ${CREATE_PAYMENT_URL}`,
      });
      return false;
    }
  };

  const runAllTests = async () => {
    setRunning(true);
    const t1 = await runTest1();
    const t2 = t1 ? await runTest2() : false;
    await runTest3(); // backend test is independent
    void t2;
    setRunning(false);
  };

  const allPassed =
    frontendTest.status === "pass" &&
    stripeJsTest.status === "pass" &&
    backendTest.status === "pass";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to home
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Stripe Integration Test</h1>
          <p className="text-slate-600">
            Verify that your Stripe keys are wired up correctly on both the frontend and the
            Firebase Functions backend.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Run diagnostics</CardTitle>
                <CardDescription>
                  Runs 3 checks. Test #3 creates a real PaymentIntent for $1.00 in your Stripe
                  account (no charge is captured — it's just an intent).
                </CardDescription>
              </div>
              <Button onClick={runAllTests} disabled={running} size="lg">
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…
                  </>
                ) : (
                  "Run all tests"
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {allPassed && (
          <Alert className="mb-6 border-green-300 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertTitle className="text-green-900">
              All tests passed — Stripe is fully integrated.
            </AlertTitle>
            <AlertDescription className="text-green-800">
              Payments, subscriptions, and webhooks are ready. Don't forget to register your webhook
              endpoint in the Stripe Dashboard (see Step 4 below).
            </AlertDescription>
          </Alert>
        )}

        {/* Test 1 */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                1. Frontend publishable key (VITE_STRIPE_PUBLISHABLE_KEY)
              </CardTitle>
              <StatusBadge status={frontendTest.status} />
            </div>
          </CardHeader>
          <CardContent>
            {frontendTest.status === "idle" ? (
              <p className="text-sm text-slate-500">
                Checks that <code className="bg-slate-100 px-1.5 py-0.5 rounded">.env</code>{" "}
                contains a valid <code>pk_live_…</code> or <code>pk_test_…</code> key.
              </p>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-900">{frontendTest.message}</p>
                {frontendTest.details && (
                  <pre className="mt-2 text-xs bg-slate-100 p-3 rounded whitespace-pre-wrap break-all">
                    {frontendTest.details}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test 2 */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">2. Stripe.js loads in the browser</CardTitle>
              <StatusBadge status={stripeJsTest.status} />
            </div>
          </CardHeader>
          <CardContent>
            {stripeJsTest.status === "idle" ? (
              <p className="text-sm text-slate-500">
                Loads the Stripe.js SDK with your publishable key to confirm it's valid.
              </p>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-900">{stripeJsTest.message}</p>
                {stripeJsTest.details && (
                  <pre className="mt-2 text-xs bg-slate-100 p-3 rounded whitespace-pre-wrap break-all">
                    {stripeJsTest.details}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test 3 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                3. Backend Cloud Function (createTaxProPayment)
              </CardTitle>
              <StatusBadge status={backendTest.status} />
            </div>
            <CardDescription className="font-mono text-xs break-all">
              POST {CREATE_PAYMENT_URL}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {backendTest.status === "idle" ? (
              <p className="text-sm text-slate-500">
                Calls your deployed function with a $1.00 test payload. If your{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded">stripe.secret</code> is set
                correctly, Stripe will return a <code>clientSecret</code>.
              </p>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-900">{backendTest.message}</p>
                {backendTest.details && (
                  <pre className="mt-2 text-xs bg-slate-100 p-3 rounded whitespace-pre-wrap break-all max-h-64 overflow-auto">
                    {backendTest.details}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook info */}
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
              <div>
                <CardTitle className="text-lg text-amber-900">
                  4. Webhook endpoint (manual setup)
                </CardTitle>
                <CardDescription className="text-amber-800">
                  Webhook delivery can't be auto-tested from the browser — Stripe must send the
                  event. Register this URL in your Stripe Dashboard:
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white border border-amber-200 rounded p-3 font-mono text-xs break-all">
              {WEBHOOK_URL}
            </div>
            <ol className="text-sm text-amber-900 space-y-1.5 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://dashboard.stripe.com/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center"
                >
                  Stripe Dashboard → Webhooks <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </li>
              <li>Click "Add endpoint" and paste the URL above</li>
              <li>
                Subscribe to: <code className="bg-white px-1 rounded">payment_intent.succeeded</code>
                , <code className="bg-white px-1 rounded">payment_intent.payment_failed</code>,{" "}
                <code className="bg-white px-1 rounded">customer.subscription.updated</code>,{" "}
                <code className="bg-white px-1 rounded">customer.subscription.deleted</code>
              </li>
              <li>
                Copy the signing secret (whsec_…) and confirm it matches what you set with{" "}
                <code className="bg-white px-1 rounded">firebase functions:config:set</code>
              </li>
              <li>Click "Send test webhook" in the Stripe Dashboard to verify delivery</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between border-b pb-2">
                <dt className="text-slate-600">Firebase project</dt>
                <dd className="font-mono">{FIREBASE_PROJECT_ID}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-slate-600">Stripe mode (frontend)</dt>
                <dd>
                  {keyMode === "LIVE" && (
                    <Badge className="bg-red-100 text-red-800">LIVE</Badge>
                  )}
                  {keyMode === "TEST" && (
                    <Badge className="bg-blue-100 text-blue-800">TEST</Badge>
                  )}
                  {keyMode === "UNKNOWN" && <Badge variant="outline">Not set</Badge>}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Publishable key prefix</dt>
                <dd className="font-mono">
                  {pubKey ? `${pubKey.substring(0, 14)}…` : "(none)"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StripeTest;
