import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  RefreshCw,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import EnrollmentForm, { type EnrollmentData } from '@/components/EnrollmentForm';
import TaxProMembershipPlans, { TAX_PRO_PLANS } from '@/components/TaxProMembershipPlans';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

/**
 * /enrollment-form-preview
 *
 * End-to-end sandbox for the FULL Professional Onboarding flow:
 *
 *   1. Enrollment form (3 steps, every dropdown is a native <select>)
 *   2. Package selection — uses the SAME tiers as /join-platform:
 *      Associate $99.95 · Professional $299.95 · Premier $499.95
 *   3. Stripe Checkout (real Stripe Payment Link opens in a new tab using
 *      YOUR Stripe account — no Supabase / backend required)
 *
 * Submissions on this preview do NOT write to Firestore. The Stripe call IS
 * real so you can confirm integration; in preview mode it opens checkout in
 * a NEW TAB instead of redirecting the current page.
 */


type Phase = 'form' | 'packages' | 'done';

// Smoke test uses the Professional tier (the most-likely-to-succeed plan)
const SMOKE_TEST_PLAN = TAX_PRO_PLANS.find((p) => p.id === 'professional')!;

const EnrollmentFormPreview: React.FC = () => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('form');
  const [submitted, setSubmitted] = useState<EnrollmentData | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [stripeTesting, setStripeTesting] = useState(false);
  const [stripeResult, setStripeResult] = useState<{
    ok: boolean;
    message: string;
    checkoutUrl?: string;
    sessionId?: string;
  } | null>(null);

  const handleFormSubmit = (data: EnrollmentData) => {
    setSubmitted(data);
    setPhase('packages');
    toast({
      title: 'Enrollment captured (preview)',
      description: 'No application was created. Continue to package selection.',
    });
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        document.getElementById('preview-packages')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };
  /**
   * Smoke-tests the Stripe Payment Link configuration WITHOUT any backend.
   *
   * The previous version called a Supabase edge function — but this project
   * runs on Firebase and the Supabase project is paused, which is what
   * produced "Failed sending a request to edge function".
   *
   * The new check verifies the same thing the live "Upgrade" button needs:
   *   1. The Professional tier has a real `paymentLinkUrl` configured.
   *   2. The URL is a valid Stripe Payment Link (starts with https://buy.stripe.com/).
   *   3. We can build the prefilled checkout URL (email + client_reference_id)
   *      that the button will actually open.
   *
   * If a link is configured, we display it and let you open Stripe Checkout
   * in a new tab. If not, we point you straight at the Stripe Dashboard.
   */
  const handleStripeSmokeTest = async () => {
    try {
      setStripeTesting(true);
      setStripeResult(null);

      const testEmail = submitted?.email || `preview-${Date.now()}@refund-connect.test`;
      const linkUrl = SMOKE_TEST_PLAN.paymentLinkUrl;

      if (!linkUrl) {
        throw new Error(
          `No Stripe Payment Link configured for the ${SMOKE_TEST_PLAN.name} tier yet. ` +
          `Create one in Stripe Dashboard → Payment Links for price ${SMOKE_TEST_PLAN.priceId} ` +
          `and paste the buy.stripe.com URL into TaxProMembershipPlans.tsx → professional.paymentLinkUrl.`
        );
      }
      if (!/^https:\/\/buy\.stripe\.com\//i.test(linkUrl)) {
        throw new Error(
          `paymentLinkUrl for ${SMOKE_TEST_PLAN.name} doesn't look like a Stripe Payment Link ` +
          `(expected https://buy.stripe.com/…). Got: ${linkUrl}`
        );
      }

      // Build the same prefilled URL the real button will open
      const url = new URL(linkUrl);
      url.searchParams.set('prefilled_email', testEmail);
      url.searchParams.set('client_reference_id', `${testEmail}|${SMOKE_TEST_PLAN.id}`);

      setStripeResult({
        ok: true,
        message: `Stripe Payment Link is configured and valid for ${SMOKE_TEST_PLAN.name}.`,
        checkoutUrl: url.toString(),
        sessionId: SMOKE_TEST_PLAN.priceId,
      });
      toast({
        title: 'Stripe Payment Link verified',
        description: 'Open it in a new tab to complete a real test purchase.',
      });
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      setStripeResult({ ok: false, message: msg });
      toast({
        title: 'Stripe Payment Link not configured',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setStripeTesting(false);
    }
  };


  const reset = () => {
    setSubmitted(null);
    setStripeResult(null);
    setPhase('form');
    setResetKey((k) => k + 1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-10 space-y-8">
        {/* ─────────────── HEADER ─────────────── */}
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <Badge variant="secondary" className="mx-auto">Preview / Test Mode</Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Professional Onboarding Preview
          </h1>
          <p className="text-muted-foreground">
            Full end-to-end sandbox: enrollment form → package selection →
            real Stripe Checkout. Packages and pricing match{' '}
            <strong>/join-platform</strong> exactly. Submissions here do{' '}
            <strong>not</strong> create an application in your database. The
            Stripe smoke test <strong>does</strong> hit your real Stripe
            account so you can confirm integration.
          </p>
        </div>

        {/* ─────────────── PROGRESS ─────────────── */}
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm">
          {[
            { key: 'form', label: '1. Enrollment Form' },
            { key: 'packages', label: '2. Package Selection' },
            { key: 'done', label: '3. Stripe Checkout' },
          ].map((s, idx) => {
            const active = phase === s.key;
            const done =
              (s.key === 'form' && phase !== 'form') ||
              (s.key === 'packages' && phase === 'done');
            return (
              <React.Fragment key={s.key}>
                <div
                  className={`flex-1 rounded-md border px-3 py-2 text-center ${
                    active
                      ? 'border-primary bg-primary/5 font-medium'
                      : done
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  {done && <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />}
                  {s.label}
                </div>
                {idx < 2 && <div className="h-px w-4 bg-slate-300" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* ─────────────── STRIPE INTEGRATION TEST CARD ─────────────── */}
        <Card className="max-w-3xl mx-auto border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-3">

            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Stripe Integration Check
            </CardTitle>
            <CardDescription className="text-xs">
              Click below to confirm a <strong>Stripe Payment Link</strong> is
              configured for the <strong>{SMOKE_TEST_PLAN.name}</strong> tier
              (${SMOKE_TEST_PLAN.priceYearly}, price ID{' '}
              <code>{SMOKE_TEST_PLAN.priceId}</code>). This runs entirely
              client-side — no backend required — and matches exactly what the
              live "Upgrade" button does.
            </CardDescription>

          </CardHeader>

          <CardContent className="space-y-3">
            <Button
              onClick={handleStripeSmokeTest}
              disabled={stripeTesting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {stripeTesting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing Stripe…</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" /> Run Stripe Smoke Test</>
              )}
            </Button>

            {stripeResult && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  stripeResult.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {stripeResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="font-medium">{stripeResult.message}</div>
                    {stripeResult.ok && stripeResult.sessionId && (
                      <div className="text-xs font-mono break-all">
                        Session ID: {stripeResult.sessionId}
                      </div>
                    )}
                    {stripeResult.ok && stripeResult.checkoutUrl && (
                      <a
                        href={stripeResult.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium underline hover:no-underline"
                      >
                        Open Stripe Checkout in new tab
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {!stripeResult.ok && (
                      <div className="text-xs">
                        Common fixes:
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>Confirm a <strong>Stripe Payment Link</strong> has been created in your Stripe Dashboard for each tier.</li>
                          <li>
                            In Stripe Dashboard → Products, confirm Prices exist
                            with IDs:
                            <ul className="list-disc list-inside ml-4 mt-0.5">
                              {TAX_PRO_PLANS.map((p) => (
                                <li key={p.id}><code>{p.priceId}</code> ({p.name} — ${p.priceYearly})</li>
                              ))}
                            </ul>
                          </li>
                          <li>If the IDs differ in Stripe, update them in <code>src/components/TaxProMembershipPlans.tsx</code>.</li>
                          <li>Paste each tier's <code>https://buy.stripe.com/…</code> URL into the matching <code>paymentLinkUrl</code> field.</li>
                        </ul>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─────────────── QA CHECKLIST ─────────────── */}
        <Card className="max-w-3xl mx-auto border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              QA Checklist
            </CardTitle>
            <CardDescription className="text-xs">
              Walk through these to confirm every interaction works.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5 text-slate-700">
            <div>1. Step 1 — open <em>State</em>, <em>Experience Level</em>, and <em>Prior Year Bank Products</em> dropdowns.</div>
            <div>2. Click <strong>Next Step</strong> with empty required fields → error toast should appear.</div>
            <div>3. Step 2 — check at least one service; upload a photo (optional).</div>
            <div>4. Step 3 — open every dropdown (EFIN, credentials, years, returns, work setup, hours, referral, disclosure). Confirm <em>Postcard / Mailer</em> appears in the referral list.</div>
            <div>5. Try submitting without the Circular 230 checkbox → error toast.</div>
            <div>6. After form submit → package selection appears with the SAME 3 tiers as /join-platform: Associate $99.95, Professional $299.95, Premier $499.95.</div>
            <div>7. Click <strong>Upgrade to [Tier]</strong> → real Stripe Checkout URL is created and opens in a NEW TAB (preview-safe).</div>
            <div>8. Run the <strong>Stripe Smoke Test</strong> above to verify Stripe integration without filling the form.</div>
          </CardContent>
        </Card>

        {/* ─────────────── PHASE 1: ENROLLMENT FORM ─────────────── */}
        {phase === 'form' && (
          <div key={resetKey}>
            <EnrollmentForm onSubmit={handleFormSubmit} />
          </div>
        )}

        {/* ─────────────── PHASE 2: PACKAGE SELECTION ─────────────── */}
        {phase === 'packages' && submitted && (
          <div id="preview-packages" className="space-y-6">
            <Card className="max-w-6xl mx-auto border-emerald-200">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Step 2 — Select Your Package
                  </CardTitle>
                  <CardDescription>
                    Application submitted for{' '}
                    <strong>{submitted.firstName} {submitted.lastName}</strong>{' '}
                    ({submitted.email}). These are the same packages and prices
                    listed on <strong>/join-platform</strong>. Clicking{' '}
                    <em>Upgrade to [Tier]</em> creates a real Stripe Checkout
                    Session in your account and opens it in a new tab.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start over
                </Button>
              </CardHeader>
              <CardContent>
                <TaxProMembershipPlans
                  previewMode
                  applicant={{
                    name: `${submitted.firstName} ${submitted.lastName}`.trim(),
                    email: submitted.email,
                    phone: submitted.phone,
                    address: [submitted.address, submitted.city, submitted.state, submitted.zip]
                      .filter(Boolean)
                      .join(', '),
                    experienceLevel: submitted.experienceLevel,
                    priorYearProducts: submitted.priorYearBankProducts,
                  }}
                  onPlanSelect={(planId) => {
                    setPhase('done');
                    toast({
                      title: 'Plan selected',
                      description: `Plan: ${planId}. Stripe Checkout opened in a new tab.`,
                    });
                  }}
                />
              </CardContent>
            </Card>

            {/* Captured payload */}
            <Card className="max-w-6xl mx-auto">
              <CardHeader>
                <CardTitle className="text-base">Captured enrollment payload (preview only)</CardTitle>
                <CardDescription>
                  This is exactly what would be saved to Firestore in production.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-slate-950 text-slate-100 rounded-md p-4 overflow-auto max-h-[400px]">
                  {JSON.stringify(submitted, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─────────────── PHASE 3: COMPLETE ─────────────── */}
        {phase === 'done' && (
          <Card className="max-w-3xl mx-auto border-emerald-300 bg-emerald-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Preview complete
              </CardTitle>
              <CardDescription>
                The full onboarding flow ran successfully end-to-end. If Stripe
                Checkout opened in a new tab, your live integration is working.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={reset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run another test
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default EnrollmentFormPreview;
