// =============================================================================
// MembershipPaymentDialog
// =============================================================================
// Inline Stripe Elements payment dialog used by /pricing to collect
// card details and immediately charge the tax pro for their membership tier
// upgrade. NO redirects to Stripe-hosted Checkout — payment, success, and
// failure all happen inside this dialog, which dramatically reduces drop-off.
//
// This component is what FIXES the "100+ visits, 0 sales" problem: the old
// flow tried to redirect to a Supabase edge function that didn't exist, so
// every click silently failed. This one talks straight to the deployed
// Firebase Cloud Function `createTaxProPayment` via membershipCheckoutService.
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { stripePromise, STRIPE_IS_CONFIGURED } from '@/lib/stripe';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Cache Stripe.js promises keyed by publishable key (returned by the Cloud
// Function) so card payments work even when VITE_STRIPE_PUBLISHABLE_KEY was
// never set at build time. Publishable keys are safe to expose in the browser.
const dialogStripeCache = new Map<string, Promise<Stripe | null>>();
function getDialogStripeForKey(pk: string): Promise<Stripe | null> {
  let p = dialogStripeCache.get(pk);
  if (!p) {
    p = loadStripe(pk);
    dialogStripeCache.set(pk, p);
  }
  return p;
}
import { useToast } from '@/hooks/use-toast';
import {
  createMembershipPaymentIntent,
  finalizeMembershipUpgrade,
  markAttempt,
  TIER_LEVEL,
  TIER_PRICE,
  type MembershipTier,
} from '@/services/membershipCheckoutService';

interface MembershipPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  tier: MembershipTier;
  userId: string;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  promoCode?: string;
  promoAmount?: number;
  promoDocId?: string;
  onSuccess?: () => void;
}

interface InitState {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  attemptDocId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner form that lives inside <Elements>
// ─────────────────────────────────────────────────────────────────────────────
interface InnerFormProps {
  init: InitState;
  tier: MembershipTier;
  userId: string;
  promoDocId?: string;
  promoCode?: string;
  promoAmount?: number;
  onSuccess?: () => void;
  onClose: () => void;
}

const InnerForm: React.FC<InnerFormProps> = ({
  init,
  tier,
  userId,
  promoDocId,
  promoCode,
  promoAmount,
  onSuccess,
  onClose,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (error) {
        const msg = error.message || 'Card was declined.';
        setErrorMsg(msg);
        await markAttempt(init.attemptDocId, {
          status: 'card_failed',
          error: msg,
        });
        toast({
          title: 'Payment failed',
          description: msg,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Immediately flip Firestore membership level + sync CRM + fire the
        // branded welcome email AND the internal "new sale" alert. All of
        // that happens inside finalizeMembershipUpgrade — emails are
        // best-effort and never block the success UI.
        const result = await finalizeMembershipUpgrade({
          userId,
          newLevel: TIER_LEVEL[tier],
          promoDocId,
          promoCode,
          promoAmount,
          paymentIntentId: paymentIntent.id,
          attemptDocId: init.attemptDocId,
          amountCents: init.amount,
        });
        if (!result.ok) {
          console.warn('Finalize upgrade returned error:', result.error);
        }
        if (result.emails) {
          if (!result.emails.proEmailSent) {
            console.warn(
              'Welcome email did not send:',
              result.emails.errors.proEmailError,
            );
          }
          if (!result.emails.ownerEmailSent) {
            console.warn(
              'Owner sale alert did not send:',
              result.emails.errors.ownerEmailError,
            );
          }
        }
        setDone(true);
        toast({
          title: 'Payment successful',
          description: `Welcome to ${TIER_LEVEL[tier]}! A confirmation email is on the way.`,
        });
        onSuccess?.();
      } else if (paymentIntent) {
        const msg = `Payment status: ${paymentIntent.status}. We'll email you when it clears.`;
        setErrorMsg(msg);
        await markAttempt(init.attemptDocId, {
          status: 'card_processing',
          paymentIntentStatus: paymentIntent.status,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(msg);
      await markAttempt(init.attemptDocId, {
        status: 'card_failed',
        error: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };


  if (done) {
    return (
      <div className="text-center py-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to {TIER_LEVEL[tier]}!
        </h3>
        <p className="text-gray-600 mb-6">
          Your card was charged ${(init.amount / 100).toFixed(2)} and your
          membership is now active. We've emailed your receipt and onboarding
          steps.
        </p>
        <Button onClick={onClose} size="lg" className="w-full">
          Continue
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />

      {errorMsg && (
        <Alert className="border-red-300 bg-red-50">
          <XCircle className="h-4 w-4 text-red-700" />
          <AlertTitle className="text-red-900">Payment error</AlertTitle>
          <AlertDescription className="text-red-800 text-sm">
            {errorMsg}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span>
          Your card details are encrypted and processed securely by Stripe. We
          never see your full card number.
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
          className="sm:flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || !elements || submitting}
          size="lg"
          className="sm:flex-[2] bg-green-600 hover:bg-green-700"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing payment…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay ${(init.amount / 100).toFixed(2)} — Activate {TIER_LEVEL[tier]}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Outer dialog component — fetches the clientSecret then renders <Elements>
// ─────────────────────────────────────────────────────────────────────────────

const MembershipPaymentDialog: React.FC<MembershipPaymentDialogProps> = ({
  open,
  onClose,
  tier,
  userId,
  userEmail,
  userName,
  userPhone,
  promoCode,
  promoAmount,
  promoDocId,
  onSuccess,
}) => {
  const [init, setInit] = useState<InitState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Stripe.js instance to power <Elements>, resolved at runtime from the
  // publishable key the Cloud Function returns (falls back to the build-time
  // key). This is what makes card payments work without VITE_STRIPE_PUBLISHABLE_KEY.
  const [activeStripe, setActiveStripe] = useState<Promise<Stripe | null> | null>(null);

  const finalDollars = Math.max(
    0.5,
    TIER_PRICE[tier] - (promoAmount && promoAmount > 0 ? promoAmount : 0),
  );

  useEffect(() => {
    if (!open) return;

    // Reset state when (re)opening
    setInit(null);
    setLoadError(null);
    setActiveStripe(null);


    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await createMembershipPaymentIntent({
          tier,
          userId,
          userEmail,
          userName,
          userPhone,
          promoCode,
          promoAmount,
          promoDocId,
        });
        if (cancelled) return;
        // Resolve Stripe.js from the publishable key the function returns
        // (always matches the intent's account); fall back to the build-time key.
        if (res.publishableKey && /^pk_(live|test)_/.test(res.publishableKey)) {
          setActiveStripe(getDialogStripeForKey(res.publishableKey));
        } else if (STRIPE_IS_CONFIGURED) {
          setActiveStripe(stripePromise);
        } else {
          setLoadError(
            'Card payments are not configured yet. Please contact support@refund-connect.com to complete your membership.',
          );
          return;
        }
        setInit({
          clientSecret: res.clientSecret,
          paymentIntentId: res.paymentIntentId,
          amount: res.amount,
          attemptDocId: res.attemptDocId,
        });
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not initialize secure payment.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    tier,
    userId,
    userEmail,
    userName,
    userPhone,
    promoCode,
    promoAmount,
    promoDocId,
  ]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Activate {TIER_LEVEL[tier]}
          </DialogTitle>
          <DialogDescription>
            One-time payment of{' '}
            <span className="font-semibold text-gray-900">
              ${finalDollars.toFixed(2)}
            </span>
            {promoAmount && promoAmount > 0 && (
              <span className="ml-1 text-green-700 font-medium">
                (saved ${promoAmount.toFixed(2)} with {promoCode})
              </span>
            )}{' '}
            — secured by Stripe.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <Alert className="border-red-300 bg-red-50 mt-2">
            <AlertTriangle className="h-4 w-4 text-red-700" />
            <AlertTitle className="text-red-900">
              Cannot start payment
            </AlertTitle>
            <AlertDescription className="text-red-800 text-sm whitespace-pre-wrap">
              {loadError}
            </AlertDescription>
            <div className="mt-3">
              <Button variant="outline" onClick={onClose} size="sm">
                Close
              </Button>
            </div>
          </Alert>
        ) : loading || !init || !activeStripe ? (
          <div className="py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-sm text-gray-600">
              Securing your ${finalDollars.toFixed(2)} {TIER_LEVEL[tier]} upgrade…
            </p>
          </div>
        ) : (
          <Elements
            key={init.clientSecret}
            stripe={activeStripe}
            options={{
              clientSecret: init.clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#2563eb',
                  borderRadius: '8px',
                },
              },
            }}
          >
            <InnerForm
              init={init}
              tier={tier}
              userId={userId}
              promoDocId={promoDocId}
              promoCode={promoCode}
              promoAmount={promoAmount}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          </Elements>
        )}

      </DialogContent>
    </Dialog>
  );
};

export default MembershipPaymentDialog;
