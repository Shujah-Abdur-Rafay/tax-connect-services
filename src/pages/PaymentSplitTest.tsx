import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  "refund-connect-1m30";

const VERIFY_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/verifyPaymentSplit`;

interface SplitReport {
  paymentIntentId: string;
  chargeId: string | null;
  status: string;
  amount: number;
  currency: string;
  applicationFeeAmount: number;
  applicationFeePercent: number;
  expectedFeePercent: number;
  destinationAccountId: string | null;
  transferId: string | null;
  netToPro: number;
  splitOk: boolean;
  issues: string[];
  metadata?: Record<string, string>;
}

interface RecentOrder {
  id: string;
  gig_title?: string;
  pro_name?: string;
  price?: number;
  payment_intent_id?: string | null;
  created_at?: string;
}

const fmt = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents || 0) / 100);

const PaymentSplitTest = () => {
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [report, setReport] = useState<SplitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const loadRecentPaidOrders = async () => {
    if (!db) return;
    setRecentLoading(true);
    try {
      // Pull the 10 most recent paid orders (stripe_payment_intent_id is set).
      const q = query(
        collection(db, "gig_orders"),
        where("payment_status", "==", "paid"),
        orderBy("paid_at", "desc"),
        limit(10)
      );
      let snap;
      try {
        snap = await getDocs(q);
      } catch {
        // Fallback if the composite index isn't ready: filter only on payment_status.
        const fallback = query(
          collection(db, "gig_orders"),
          where("payment_status", "==", "paid"),
          limit(20)
        );
        snap = await getDocs(fallback);
      }
      const rows: RecentOrder[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          gig_title: data.gig_title,
          pro_name: data.pro_name,
          price: Number(data.price || 0),
          payment_intent_id: data.stripe_payment_intent_id || null,
          created_at:
            data.paid_at?.toDate?.()?.toISOString?.() ||
            data.created_at?.toDate?.()?.toISOString?.() ||
            "",
        };
      });
      // Filter out any that lost their PI somehow.
      setRecentOrders(rows.filter((r) => r.payment_intent_id));
    } catch (e) {
      console.warn("[PaymentSplitTest] could not load recent paid orders", e);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    loadRecentPaidOrders();
  }, []);

  const runVerify = async (piId?: string) => {
    const target = (piId ?? paymentIntentId).trim();
    if (!target) {
      setError("Enter a PaymentIntent id (pi_…) or pick a recent paid order below.");
      return;
    }
    if (!target.startsWith("pi_")) {
      setError("That doesn’t look like a Stripe PaymentIntent id — it should start with “pi_”.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const resp = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: target }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.success === false) {
        const hint =
          resp.status === 404
            ? " → Deploy the function: firebase deploy --only functions:verifyPaymentSplit"
            : "";
        throw new Error((data?.error || `HTTP ${resp.status}`) + hint);
      }
      setReport(data as SplitReport);
      setPaymentIntentId(target);
    } catch (e: any) {
      setError(e?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const checks = useMemo(() => {
    if (!report) return [];
    const expectedFee = Math.floor(report.amount * (report.expectedFeePercent / 100));
    return [
      {
        label: "PaymentIntent status is succeeded",
        ok: report.status === "succeeded",
        actual: report.status,
        expected: "succeeded",
      },
      {
        label: "transfer_data.destination is set",
        ok: !!report.destinationAccountId,
        actual: report.destinationAccountId || "(none)",
        expected: "acct_…",
      },
      {
        label: "application_fee_amount is non-zero",
        ok: report.applicationFeeAmount > 0,
        actual: fmt(report.applicationFeeAmount, report.currency),
        expected: "> $0.00",
      },
      {
        label: `Fee percent ≈ ${report.expectedFeePercent}%`,
        ok: Math.abs(report.applicationFeePercent - report.expectedFeePercent) <= 1,
        actual: `${report.applicationFeePercent}%`,
        expected: `${report.expectedFeePercent}% ± 1%`,
      },
      {
        label: "Fee amount = floor(total × 20%)",
        ok: Math.abs(report.applicationFeeAmount - expectedFee) <= 1,
        actual: fmt(report.applicationFeeAmount, report.currency),
        expected: fmt(expectedFee, report.currency),
      },
      {
        label: "Net to pro = total − fee",
        ok:
          Math.abs(report.netToPro - (report.amount - report.applicationFeeAmount)) <= 1,
        actual: fmt(report.netToPro, report.currency),
        expected: fmt(report.amount - report.applicationFeeAmount, report.currency),
      },
    ];
  }, [report]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link
          to="/admin"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to admin
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Payment Split Integration Test
          </h1>
          <p className="text-slate-600 max-w-3xl">
            Verifies that a real gig payment was created as a Stripe Connect{" "}
            <strong>destination charge</strong> with the correct 80/20 split
            (platform keeps <strong>20%</strong> as the <code>application_fee_amount</code>;
            the remaining 80% lands in the pro&rsquo;s connected Stripe balance).
            Enter a <code>pi_…</code> id from{" "}
            <a
              href="https://dashboard.stripe.com/payments"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Stripe Dashboard
            </a>{" "}
            or pick a recent paid order below.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Verify a PaymentIntent</CardTitle>
            <CardDescription className="font-mono text-xs break-all">
              POST {VERIFY_URL}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pi" className="text-sm">
                PaymentIntent ID
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="pi"
                  placeholder="pi_3OtZxLHdGQpsHqIn0xxxxxxx"
                  value={paymentIntentId}
                  onChange={(e) => setPaymentIntentId(e.target.value)}
                  className="font-mono"
                />
                <Button
                  onClick={() => runVerify()}
                  disabled={loading || !paymentIntentId.trim()}
                  className="shrink-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying
                    </>
                  ) : (
                    <>
                      Verify split <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Verification failed</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {report && (
          <>
            <Card
              className={`mb-6 border-2 ${
                report.splitOk ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle
                      className={`text-2xl ${
                        report.splitOk ? "text-green-900" : "text-red-900"
                      }`}
                    >
                      {report.splitOk ? (
                        <span className="inline-flex items-center">
                          <CheckCircle2 className="w-6 h-6 mr-2" /> Split looks correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center">
                          <XCircle className="w-6 h-6 mr-2" /> Split is misconfigured
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription
                      className={report.splitOk ? "text-green-800" : "text-red-800"}
                    >
                      PaymentIntent{" "}
                      <code className="font-mono">{report.paymentIntentId}</code> ·{" "}
                      {report.chargeId ? (
                        <>charge <code className="font-mono">{report.chargeId}</code></>
                      ) : (
                        "no charge yet"
                      )}
                    </CardDescription>
                  </div>
                  <Badge
                    className={
                      report.splitOk
                        ? "bg-green-200 text-green-900"
                        : "bg-red-200 text-red-900"
                    }
                  >
                    {report.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 border">
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Total charged
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {fmt(report.amount, report.currency)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border">
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Platform fee ({report.applicationFeePercent}%)
                    </div>
                    <div className="text-2xl font-bold text-indigo-700">
                      {fmt(report.applicationFeeAmount, report.currency)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border">
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Net to pro
                    </div>
                    <div className="text-2xl font-bold text-emerald-700">
                      {fmt(report.netToPro, report.currency)}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-4 py-2 text-left">Check</th>
                        <th className="px-4 py-2 text-left">Expected</th>
                        <th className="px-4 py-2 text-left">Actual</th>
                        <th className="px-4 py-2 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checks.map((c) => (
                        <tr key={c.label} className="border-t">
                          <td className="px-4 py-2 text-slate-900">{c.label}</td>
                          <td className="px-4 py-2 text-slate-600 font-mono text-xs">
                            {c.expected}
                          </td>
                          <td className="px-4 py-2 text-slate-900 font-mono text-xs break-all">
                            {c.actual}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {c.ok ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Pass
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">
                                <XCircle className="w-3 h-3 mr-1" /> Fail
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {report.issues.length > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Issues detected</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {report.issues.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
                    Stripe-side details (destination, transfer, metadata)
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded p-3">
                      <div className="text-xs text-slate-500 mb-1">
                        transfer_data.destination
                      </div>
                      <code className="font-mono text-xs break-all">
                        {report.destinationAccountId || "(none)"}
                      </code>
                    </div>
                    <div className="bg-slate-50 rounded p-3">
                      <div className="text-xs text-slate-500 mb-1">transfer id</div>
                      <code className="font-mono text-xs break-all">
                        {report.transferId || "(none)"}
                      </code>
                    </div>
                    {report.metadata && Object.keys(report.metadata).length > 0 && (
                      <div className="bg-slate-50 rounded p-3 md:col-span-2">
                        <div className="text-xs text-slate-500 mb-1">metadata</div>
                        <pre className="font-mono text-xs whitespace-pre-wrap break-all">
                          {JSON.stringify(report.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>

                <div className="mt-4 flex justify-end">
                  <a
                    href={`https://dashboard.stripe.com/payments/${report.paymentIntentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline inline-flex items-center"
                  >
                    Open in Stripe Dashboard
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent paid orders</CardTitle>
                <CardDescription>
                  Click any row to verify that order&rsquo;s split.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadRecentPaidOrders}
                disabled={recentLoading}
              >
                {recentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="py-8 text-center text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading recent paid orders…
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                No paid orders found yet. Run a real test payment from{" "}
                <Link to="/my-orders" className="text-blue-600 underline">
                  /my-orders
                </Link>{" "}
                first.
              </div>
            ) : (
              <div className="overflow-hidden border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Order</th>
                      <th className="px-4 py-2 text-left">Pro</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-left">PaymentIntent</th>
                      <th className="px-4 py-2 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => (
                      <tr key={o.id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="font-medium text-slate-900 truncate max-w-[220px]">
                            {o.gig_title || "Order"}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {o.id.slice(0, 12)}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-700">{o.pro_name || "—"}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          ${Number(o.price || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-700 truncate max-w-[180px]">
                          {o.payment_intent_id}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runVerify(o.payment_intent_id || "")}
                            disabled={loading}
                          >
                            Verify
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSplitTest;
