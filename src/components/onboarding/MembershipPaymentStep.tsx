import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  queueFirebaseEmail,
  buildBrandedEmail,
  ADMIN_NOTIFICATION_EMAIL,
} from '@/services/firebaseEmailService';
import { MembershipLevel } from '@/constants/membershipLevels';
import { stripePromise, STRIPE_IS_CONFIGURED } from '@/lib/stripe';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  createMembershipPaymentIntent,
  markAttempt,
  type MembershipTier as CheckoutTier,
} from '@/services/membershipCheckoutService';



/**
 * Final onboarding step — membership / FamousPay payment.
 *
 * Flow:
 *  1. Applicant picks the membership tier they want to activate.
 *  2. We call the existing Supabase `create-payment-intent` edge function to
 *     create a PaymentIntent for the tier's price (in cents).
 *  3. The returned client_secret powers a FamousPay (Stripe) Elements
 *     PaymentElement so the card is collected & confirmed in-line.
 *  4. On success we record the result on the professional's Firestore doc
 *     (membership_level, payment intent id, amount, paid timestamp, status).
 */

export interface MembershipTier {
  id: string;
  name: string;
  level: MembershipLevel;
  /** price in dollars */
  price: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: 'associate',
    name: 'Associate Partner',
    level: MembershipLevel.ACQUISITION,
    price: 99.95,
    tagline: 'Referral & marketing partner — get listed and start taking clients.',
    features: [
      'Public directory listing',
      'Client lead notifications',
      'Standard support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional Partner',
    level: MembershipLevel.PROFESSIONAL_PACKAGE,
    price: 299.95,
    tagline: 'Most popular — full toolkit for growing preparers.',
    features: [
      'Everything in Associate Partner',
      'Priority placement in search',
      'Document management & e-sign',
      'Marketing materials & templates',
    ],
    highlight: true,
  },
  {
    id: 'premier',
    name: 'Premier Partner',
    level: MembershipLevel.PREMIUM_PARTNER,
    price: 499.95,
    tagline: 'Top tier — maximum reach and premium tooling.',
    features: [
      'Everything in Professional Partner',
      'Featured "Premier Partner" badge',
      'Top of directory & map results',
      'Dedicated partner support',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Manual activation fallback
// If the secure payment server is unreachable or a card payment fails, we send
// the applicant to this hosted JotForm so support can complete their membership
// manually. This guarantees nobody gets stuck at the final step.
// ─────────────────────────────────────────────────────────────────────────────
export const MANUAL_ACTIVATION_URL = 'https://pci.jotform.com/form/252927299861170';

const ManualActivationFallback: React.FC<{ reason?: string }> = ({ reason }) => (
  <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
    <p className="text-sm font-semibold text-amber-900">
      Having trouble paying online?
    </p>
    <p className="text-sm text-amber-800">
      {reason ||
        'No problem — you can complete your membership securely through our manual activation form. Our team will activate your account as soon as the payment is received.'}
    </p>
    <a
      href={MANUAL_ACTIVATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
    >
      <ExternalLink className="h-4 w-4" />
      Complete Membership Manually
    </a>
  </div>
);

interface Props {
  uid: string;
  signerName: string;
  signerEmail: string;
  /** Pre-select a tier if one was chosen earlier in the flow. */
  defaultTierId?: string;
  onBack: () => void;
  onComplete: (tier: MembershipTier, paymentIntentId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner card-collection form (must be rendered inside <Elements>)
// ─────────────────────────────────────────────────────────────────────────────
const InnerPaymentForm: React.FC<{
  tier: MembershipTier;
  uid: string;
  signerName: string;
  signerEmail: string;
  attemptDocId: string;
  onComplete: (tier: MembershipTier, paymentIntentId: string) => void;
  onChangeTier: () => void;
}> = ({ tier, uid, signerName, signerEmail, attemptDocId, onComplete, onChangeTier }) => {

  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const recordOnProfile = async (paymentIntentId: string) => {
    try {
      await setDoc(
        doc(db, 'professionals', uid),
        {
          membership_level: tier.level,
          membership_tier: tier.name,
          membership_status: 'active',
          membership_paid: true,
          membership_amount: tier.price,
          membership_billing: 'one_time',
          membership_payment_intent_id: paymentIntentId,
          membership_paid_at: serverTimestamp(),
          membership_started_at: serverTimestamp(),
          onboarding_completed: true,
          onboarding_step: 7,
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.error('[MembershipPaymentStep] Failed to record payment on profile:', err);
      // Non-blocking: payment already succeeded. Surface a soft warning so the
      // user / admin can reconcile, but still let them complete onboarding.
      toast({
        title: 'Payment received',
        description:
          'Your payment went through, but we had trouble updating your profile. Our team will confirm your tier shortly.',
      });
    }
  };

  /**
   * Queue a branded receipt email to the professional confirming their
   * membership payment. Non-blocking — never throws / never blocks completion.
   */
  const sendReceiptEmail = async (paymentIntentId: string) => {
    if (!signerEmail) return;
    try {
      const paidDate = new Date().toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      });
      const amountStr = `$${tier.price.toFixed(2)} USD`;
      const portalUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/member-portal` : '';

      const receiptRows = [
        { label: 'Membership Tier', value: tier.name },
        { label: 'Amount Paid', value: amountStr },
        { label: 'Payment Type', value: 'One-Time Payment' },
        { label: 'Payment ID', value: paymentIntentId },
        { label: 'Date', value: paidDate },
      ];

      const html = buildBrandedEmail({
        title: 'Payment Receipt — Refund Connect Membership',
        intro: `Hi ${signerName || 'there'},\n\nThank you for activating your Refund Connect membership! This email is your official receipt. Your ${tier.name} membership is now active.`,
        rows: receiptRows,
        ctaLabel: 'Go to Member Portal',
        ctaUrl: portalUrl,
        footer:
          'Keep this receipt for your records. Questions about your membership? Contact support@refund-connect.com.',
        accentColor: '#2563eb',
      });

      const sharedMeta = {
        uid,
        tier: tier.name,
        level: tier.level,
        amount: tier.price,
        payment_intent_id: paymentIntentId,
        paid_at: paidDate,
      };

      // 1) Receipt to the professional.
      await queueFirebaseEmail({
        to: signerEmail,
        subject: `Receipt: ${tier.name} Membership — ${amountStr}`,
        html,
        text:
          `Thank you for your Refund Connect membership payment.\n\n` +
          `Tier: ${tier.name}\nAmount: ${amountStr}\nPayment Type: One-Time Payment\n` +
          `Payment ID: ${paymentIntentId}\nDate: ${paidDate}\n\n` +
          `Member Portal: ${portalUrl}\n`,
        category: 'membership_receipt',
        meta: { ...sharedMeta, recipient: 'professional' },
      });

      // 2) Copy to the admin team (info@alliance-tax.com) so every membership
      //    activation is recorded in their inbox AND the admin notifications
      //    dashboard. Includes the professional's identifying details.
      const adminHtml = buildBrandedEmail({
        title: 'New Membership Activation',
        intro: `A professional just activated their Refund Connect membership.\n\nProfessional: ${signerName || 'Unknown'}\nEmail: ${signerEmail}\nFirebase UID: ${uid}`,
        rows: receiptRows,
        footer:
          'This is an automated admin record of a membership payment. No action is required.',
        accentColor: '#0f766e',
      });

      await queueFirebaseEmail({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `[Admin Copy] New ${tier.name} Membership — ${signerName || signerEmail} (${amountStr})`,
        html: adminHtml,
        text:
          `New membership activation.\n\n` +
          `Professional: ${signerName || 'Unknown'}\nEmail: ${signerEmail}\nUID: ${uid}\n\n` +
          `Tier: ${tier.name}\nAmount: ${amountStr}\nPayment Type: One-Time Payment\n` +
          `Payment ID: ${paymentIntentId}\nDate: ${paidDate}\n`,
        category: 'admin_membership_receipt',
        meta: {
          ...sharedMeta,
          recipient: 'admin',
          professional_name: signerName || '',
          professional_email: signerEmail,
        },
      });
    } catch (err) {
      console.warn('[MembershipPaymentStep] Failed to queue receipt email:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });

    if (error) {
      toast({
        title: 'Payment failed',
        description: error.message || 'Your card was not charged. Please try again.',
        variant: 'destructive',
      });
      setPaymentFailed(true);
      setLoading(false);
      return;
    }

    if (paymentIntent?.status !== 'succeeded') {
      toast({
        title: 'Payment not completed',
        description: `Status: ${paymentIntent?.status ?? 'unknown'}. Please try again.`,
        variant: 'destructive',
      });
      setPaymentFailed(true);
      setLoading(false);
      return;
    }

    await recordOnProfile(paymentIntent.id);

    // Mark the funnel attempt as PAID in Firestore so the admin dashboard
    // stays in sync (non-blocking helper — swallows its own errors).
    if (attemptDocId) {
      void markAttempt(attemptDocId, {
        status: 'paid',
        paymentIntentId: paymentIntent.id,
        paidAt: serverTimestamp(),
      });
    }

    // Queue the branded receipt email (non-blocking).
    await sendReceiptEmail(paymentIntent.id);


    toast({
      title: 'Membership activated!',
      description: `You're now a ${tier.name} member. Charged $${tier.price.toFixed(2)}.`,
    });
    setLoading(false);
    onComplete(tier, paymentIntent.id);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border bg-blue-50 border-blue-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-blue-700 font-medium">Selected plan</p>
          <p className="text-lg font-bold text-blue-900">
            {tier.name} — ${tier.price.toFixed(2)}
          </p>
          <p className="text-xs text-blue-600">One-time payment</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onChangeTier} disabled={loading}>
          Change plan
        </Button>
      </div>

      <PaymentElement />

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        Payments are securely processed. Your card details never touch our servers.
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700"
        disabled={!stripe || !elements || loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay ${tier.price.toFixed(2)} & Activate Membership
          </>
        )}
      </Button>

      {paymentFailed && (
        <ManualActivationFallback reason="Your online payment didn't go through. You can finish activating your membership using our secure manual activation form, and our team will confirm your account once payment is received." />
      )}
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tier picker
// ─────────────────────────────────────────────────────────────────────────────
const TierPicker: React.FC<{
  selectedId: string;
  onSelect: (id: string) => void;
}> = ({ selectedId, onSelect }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {MEMBERSHIP_TIERS.map((tier) => {
      const selected = tier.id === selectedId;
      return (
        <button
          key={tier.id}
          type="button"
          onClick={() => onSelect(tier.id)}
          className={`text-left rounded-xl border-2 p-5 transition-all relative ${
            selected
              ? 'border-blue-600 bg-blue-50 shadow-md'
              : 'border-gray-200 hover:border-blue-300 bg-white'
          }`}
        >
          {tier.highlight && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
              <Star className="h-3 w-3" /> Most popular
            </span>
          )}
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-gray-900">{tier.name}</h3>
            {selected && <CheckCircle className="h-5 w-5 text-blue-600" />}
          </div>
          <p className="text-2xl font-extrabold text-gray-900">
            ${tier.price.toFixed(2)}
            <span className="text-sm font-medium text-gray-500"> one-time</span>
          </p>
          <p className="text-[11px] text-gray-400 mb-1">Single payment — no recurring charges</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">{tier.tagline}</p>
          <ul className="space-y-1.5">
            {tier.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </button>
      );
    })}
  </div>
);



// Cache Stripe.js promises keyed by publishable key so we only download the
// library once per key, even across multiple "Continue to Payment" clicks.
const runtimeStripeCache = new Map<string, Promise<Stripe | null>>();
function getStripeForKey(pk: string): Promise<Stripe | null> {
  let p = runtimeStripeCache.get(pk);
  if (!p) {
    p = loadStripe(pk);
    runtimeStripeCache.set(pk, p);
  }
  return p;
}


const MembershipPaymentStep: React.FC<Props> = ({
  uid,
  signerName,
  signerEmail,
  defaultTierId,
  onBack,
  onComplete,
}) => {
  const { toast } = useToast();
  const [selectedTierId, setSelectedTierId] = useState(
    defaultTierId && MEMBERSHIP_TIERS.some((t) => t.id === defaultTierId)
      ? defaultTierId
      : 'professional',
  );
  const [phase, setPhase] = useState<'select' | 'pay'>('select');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // The Stripe.js instance to power <Elements>. We resolve this at runtime —
  // preferring the publishable key returned by the edge function (which always
  // matches the account that created the PaymentIntent), falling back to the
  // build-time VITE key. This is what fixes the "Card payments are not
  // configured yet" message when the env var isn't set at build time.
  const [activeStripe, setActiveStripe] = useState<Promise<Stripe | null> | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [attemptDocId, setAttemptDocId] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);


  const selectedTier = useMemo(
    () => MEMBERSHIP_TIERS.find((t) => t.id === selectedTierId)!,
    [selectedTierId],
  );

  const startPayment = async () => {
    setInitializing(true);
    setLoadError(null);
    try {
      // 100% Firebase: create the one-time PaymentIntent via the deployed
      // Cloud Function `createTaxProPayment` (through membershipCheckoutService).
      // No Supabase / edge functions involved. The tier ids on this screen
      // ('associate' | 'professional' | 'premier') line up exactly with the
      // CheckoutTier union, so we can pass the id straight through.
      //
      // We create the intent FIRST, then load Stripe.js using the publishable
      // key the Cloud Function returns. That key is guaranteed to match the
      // account that created the PaymentIntent, so card payments work even when
      // VITE_STRIPE_PUBLISHABLE_KEY was never set at build time — which is what
      // used to trigger the "Card payments are not configured yet" message.
      const res = await createMembershipPaymentIntent({
        tier: selectedTier.id as CheckoutTier,
        userId: uid,
        userEmail: signerEmail,
        userName: signerName,
      });

      if (!res.clientSecret) {
        throw new Error('Payment server did not return a client secret. Please try again.');
      }

      // Resolve which publishable key to load Stripe.js with:
      //   1. The key returned by the Cloud Function (always matches the intent).
      //   2. Fallback to the build-time VITE_STRIPE_PUBLISHABLE_KEY if present.
      let stripeInstance: Promise<Stripe | null> | null = null;
      if (res.publishableKey && /^pk_(live|test)_/.test(res.publishableKey)) {
        stripeInstance = getStripeForKey(res.publishableKey);
      } else if (STRIPE_IS_CONFIGURED) {
        stripeInstance = stripePromise;
      }

      if (!stripeInstance) {
        throw new Error(
          'Card payments are not configured yet. Please contact support@refund-connect.com to complete your membership.',
        );
      }

      // Stash the attempt id so we can mark it paid after confirmation.
      setAttemptDocId(res.attemptDocId || '');
      setActiveStripe(stripeInstance);
      setClientSecret(res.clientSecret);
      setPhase('pay');
    } catch (err: any) {
      const msg = err?.message || 'Could not start the payment. Please try again.';
      setLoadError(msg);
      toast({ title: 'Payment unavailable', description: msg, variant: 'destructive' });
    } finally {
      setInitializing(false);
    }
  };



  // If the user changes plan after a secret was created, force a new intent.
  useEffect(() => {
    if (phase === 'pay') {
      setPhase('select');
      setClientSecret(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTierId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-600" />
          Activate Your Membership
        </CardTitle>
        <CardDescription>
          You're almost done! Choose your membership tier and complete payment to
          activate your professional account. This is a one-time payment — there
          are no recurring or subscription charges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError && (
          <>
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
            <ManualActivationFallback reason="We couldn't start the secure online payment right now. You can complete your membership instantly using our secure manual activation form — our team will activate your account as soon as payment is received." />
          </>
        )}

        {phase === 'select' && (
          <>
            <TierPicker selectedId={selectedTierId} onSelect={setSelectedTierId} />

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onBack} className="sm:flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                type="button"
                onClick={startPayment}
                disabled={initializing}
                className="sm:flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {initializing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing payment…
                  </>
                ) : (
                  <>
                    Continue to Payment — ${selectedTier.price.toFixed(2)}
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {phase === 'pay' && clientSecret && activeStripe && (
          <Elements
            key={clientSecret}
            stripe={activeStripe}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <InnerPaymentForm
              tier={selectedTier}
              uid={uid}
              signerName={signerName}
              signerEmail={signerEmail}
              attemptDocId={attemptDocId}
              onComplete={onComplete}
              onChangeTier={() => {
                setPhase('select');
                setClientSecret(null);
              }}
            />

          </Elements>
        )}
      </CardContent>
    </Card>
  );
};

export default MembershipPaymentStep;
