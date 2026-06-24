import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { stripePromise, STRIPE_IS_CONFIGURED } from "@/lib/stripe";

const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  "refund-connect-1m30";

const CREATE_PAYMENT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/createTaxProPayment`;

const pubKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const isLive = pubKey?.startsWith("pk_live_");
const isTest = pubKey?.startsWith("pk_test_");

type PaymentResult =
  | { status: "succeeded"; id: string; amount: number }
  | { status: "failed"; message: string }
  | { status: "processing"; id: string }
  | null;

interface CheckoutFormProps {
  amountCents: number;
  onResult: (r: PaymentResult) => void;
}

const CheckoutForm = ({ amountCents, onResult }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg(null);
    onResult(null);

    // Use confirmPayment without redirect so we can show inline success
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      const msg = error.message || "Payment failed";
      setErrorMsg(msg);
      onResult({ status: "failed", message: msg });
      setSubmitting(false);
      return;
    }

    if (paymentIntent) {
      if (paymentIntent.status === "succeeded") {
        onResult({
          status: "succeeded",
          id: paymentIntent.id,
          amount: paymentIntent.amount,
        });
      } else if (
        paymentIntent.status === "processing" ||
        paymentIntent.status === "requires_capture"
      ) {
        onResult({ status: "processing", id: paymentIntent.id });
      } else {
        onResult({
          status: "failed",
          message: `PaymentIntent status: ${paymentIntent.status}`,
        });
      }
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {errorMsg && (
        <Alert className="border-red-300 bg-red-50">
          <XCircle className="h-4 w-4 text-red-700" />
          <AlertTitle className="text-red-900">Payment error</AlertTitle>
          <AlertDescription className="text-red-800 text-sm">{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || !elements || submitting}
        size="lg"
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing payment…
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay ${(amountCents / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
};

const StripeTestCheckout = () => {
  const [amountDollars, setAmountDollars] = useState("1.00");
  const [email, setEmail] = useState("stripe-test@refund-connect.com");
  const [name, setName] = useState("Stripe Test Customer");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult>(null);

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100);

  const createPaymentIntent = async () => {
    setCreating(true);
    setCreateError(null);
    setResult(null);
    setClientSecret(null);
    setPaymentIntentId(null);

    try {
      if (!amountCents || amountCents < 50) {
        throw new Error("Amount must be at least $0.50 (Stripe minimum)");
      }

      const response = await fetch(CREATE_PAYMENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountCents,
          currency: "usd",
          email,
          name,
          membershipTier: "test",
          metadata: {
            test_run: "true",
            source: "stripe_test_checkout_page",
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      if (!data?.clientSecret) {
        throw new Error("Backend did not return a clientSecret");
      }

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId || null);
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create PaymentIntent");
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setResult(null);
    setCreateError(null);
  };

  // If Stripe isn't configured, render a friendly notice
  if (!STRIPE_IS_CONFIGURED) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <Link
            to="/stripe-test"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Stripe Test
          </Link>
          <Alert className="border-red-300 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-700" />
            <AlertTitle className="text-red-900">Stripe not configured</AlertTitle>
            <AlertDescription className="text-red-800">
              Add <code className="bg-white px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> to your{" "}
              <code className="bg-white px-1 rounded">.env</code> file and rebuild.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          to="/stripe-test"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Stripe Test
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              End-to-end Test Checkout
            </h1>
            <p className="text-slate-600">
              Runs a real charge through Stripe Elements using the{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">clientSecret</code>{" "}
              returned by your{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">createTaxProPayment</code>{" "}
              Cloud Function.
            </p>
          </div>
          {isLive && <Badge className="bg-red-100 text-red-800 shrink-0">LIVE mode</Badge>}
          {isTest && <Badge className="bg-blue-100 text-blue-800 shrink-0">TEST mode</Badge>}
        </div>

        {isLive && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-700" />
            <AlertTitle className="text-red-900">You are in LIVE mode</AlertTitle>
            <AlertDescription className="text-red-800 text-sm">
              Any card you enter will be charged real money. To test safely, switch your keys to{" "}
              <code className="bg-white px-1 rounded">pk_test_…</code> /{" "}
              <code className="bg-white px-1 rounded">sk_test_…</code> and use card{" "}
              <code className="bg-white px-1 rounded">4242 4242 4242 4242</code>.
            </AlertDescription>
          </Alert>
        )}

        {isTest && (
          <Alert className="mb-6 border-blue-300 bg-blue-50">
            <CreditCard className="h-4 w-4 text-blue-700" />
            <AlertTitle className="text-blue-900">Test mode — use a test card</AlertTitle>
            <AlertDescription className="text-blue-800 text-sm space-y-1">
              <div>
                <strong>Success:</strong>{" "}
                <code className="bg-white px-1 rounded">4242 4242 4242 4242</code> · any future
                expiry · any CVC · any ZIP
              </div>
              <div>
                <strong>Decline:</strong>{" "}
                <code className="bg-white px-1 rounded">4000 0000 0000 0002</code>
              </div>
              <div>
                <strong>3D Secure:</strong>{" "}
                <code className="bg-white px-1 rounded">4000 0027 6000 3184</code>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: Configure & create PaymentIntent */}
        {!clientSecret && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Step 1 — Create a PaymentIntent</CardTitle>
              <CardDescription>
                This calls your Cloud Function and returns a{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">client_secret</code> that the
                Stripe Elements form will use.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0.50"
                    step="0.01"
                    value={amountDollars}
                    onChange={(e) => setAmountDollars(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              {createError && (
                <Alert className="border-red-300 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-700" />
                  <AlertTitle className="text-red-900">Could not create PaymentIntent</AlertTitle>
                  <AlertDescription className="text-red-800 text-sm whitespace-pre-wrap break-all">
                    {createError}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={createPaymentIntent}
                disabled={creating}
                size="lg"
                className="w-full"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating PaymentIntent…
                  </>
                ) : (
                  <>Create PaymentIntent &rarr;</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Stripe Elements payment form */}
        {clientSecret && result?.status !== "succeeded" && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Step 2 — Enter card details</CardTitle>
                  <CardDescription>
                    Charging ${(amountCents / 100).toFixed(2)} via Stripe Elements.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Start over
                </Button>
              </div>
              {paymentIntentId && (
                <div className="text-xs font-mono text-slate-500 mt-2 break-all">
                  PaymentIntent: {paymentIntentId}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#0f172a",
                      borderRadius: "8px",
                    },
                  },
                }}
              >
                <CheckoutForm amountCents={amountCents} onResult={setResult} />
              </Elements>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Result */}
        {result?.status === "succeeded" && (
          <Alert className="border-green-300 bg-green-50 mb-6">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertTitle className="text-green-900 text-lg">
              Payment succeeded — ${(result.amount / 100).toFixed(2)} charged
            </AlertTitle>
            <AlertDescription className="text-green-800 space-y-2">
              <div className="text-sm">
                Your Stripe integration is fully working end-to-end. Check your{" "}
                <a
                  href={
                    isLive
                      ? `https://dashboard.stripe.com/payments/${result.id}`
                      : `https://dashboard.stripe.com/test/payments/${result.id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Stripe Dashboard
                </a>{" "}
                to see the charge.
              </div>
              <div className="text-xs font-mono break-all bg-white p-2 rounded border border-green-200">
                {result.id}
              </div>
              <Button onClick={reset} variant="outline" size="sm" className="mt-2">
                <RefreshCw className="w-4 h-4 mr-1" /> Run another test
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {result?.status === "processing" && (
          <Alert className="border-blue-300 bg-blue-50 mb-6">
            <Loader2 className="h-4 w-4 text-blue-700 animate-spin" />
            <AlertTitle className="text-blue-900">Payment processing</AlertTitle>
            <AlertDescription className="text-blue-800 text-sm">
              Stripe is processing the payment. The webhook will fire{" "}
              <code className="bg-white px-1 rounded">payment_intent.succeeded</code> when it
              completes. PaymentIntent: <code className="font-mono">{result.id}</code>
            </AlertDescription>
          </Alert>
        )}

        {/* Help footer */}
        <Card className="bg-slate-100 border-slate-200">
          <CardContent className="pt-6 text-sm text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">How this works</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                The page POSTs to{" "}
                <code className="bg-white px-1 rounded text-xs">createTaxProPayment</code> on your
                Firebase Functions backend.
              </li>
              <li>
                That function uses your{" "}
                <code className="bg-white px-1 rounded text-xs">stripe.secret</code> to create a
                PaymentIntent and returns the{" "}
                <code className="bg-white px-1 rounded text-xs">client_secret</code>.
              </li>
              <li>
                Stripe Elements renders a real card form bound to that{" "}
                <code className="bg-white px-1 rounded text-xs">client_secret</code>.
              </li>
              <li>
                When you submit, the card is charged and Stripe fires{" "}
                <code className="bg-white px-1 rounded text-xs">payment_intent.succeeded</code> to
                your webhook endpoint.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StripeTestCheckout;
