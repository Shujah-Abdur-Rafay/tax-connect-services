import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { stripePromise, STRIPE_IS_CONFIGURED } from '@/lib/stripe';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// ─────────────────────────────────────────────────────────────────────────────
// 100% Firebase: this generic one-off payment form creates its PaymentIntent
// via the deployed Cloud Function `createTaxProPayment` (default "membership"
// platform-charge flow). No Supabase edge functions involved.
// ─────────────────────────────────────────────────────────────────────────────
const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  'refund-connect-1m30';
const CREATE_PAYMENT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/createTaxProPayment`;

// Cache Stripe.js promises keyed by publishable key (returned by the Cloud
// Function) so card payments work even when VITE_STRIPE_PUBLISHABLE_KEY was
// never set at build time. Publishable keys are safe to expose in the browser.
const paymentStripeCache = new Map<string, Promise<Stripe | null>>();
function getPaymentStripeForKey(pk: string): Promise<Stripe | null> {
  let p = paymentStripeCache.get(pk);
  if (!p) {
    p = loadStripe(pk);
    paymentStripeCache.set(pk, p);
  }
  return p;
}

interface PaymentFormProps {
  amount: number; // dollars
  description: string;
  onSuccess?: () => void;
  metadata?: Record<string, string>;
}

/**
 * Inner card-collection form. Must live inside <Elements> so the
 * useStripe/useElements hooks have access to the Stripe instance.
 */
const StripePaymentFields: React.FC<{
  amount: number;
  onSuccess?: () => void;
}> = ({ amount, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
      },
    });

    if (error) {
      toast({
        title: 'Payment failed',
        description: error.message || 'Your card was not charged.',
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      toast({
        title: 'Payment successful',
        description: `Charged $${amount.toFixed(2)}.`,
      });
      onSuccess?.();
    } else {
      toast({
        title: 'Payment processing',
        description: `Status: ${paymentIntent?.status ?? 'unknown'}`,
      });
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex justify-between items-center pt-2">
        <span className="text-lg font-semibold">Total: ${amount.toFixed(2)}</span>
        <Button type="submit" disabled={!stripe || !elements || submitting}>
          {submitting ? 'Processing…' : `Pay $${amount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
};

export const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  description,
  onSuccess,
  metadata,
}) => {
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Stripe.js instance resolved at runtime from the publishable key the Cloud
  // Function returns (always matches the account that created the intent),
  // falling back to the build-time key.
  const [activeStripe, setActiveStripe] =
    useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setActiveStripe(null);
    setLoadError(null);

    (async () => {
      try {
        const res = await fetch(CREATE_PAYMENT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flow: 'membership',
            amount: Math.round(amount * 100), // dollars → cents
            currency: 'usd',
            metadata,
          }),
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          /* handled below */
        }
        if (cancelled) return;

        const secret = data?.clientSecret || data?.client_secret;
        if (!res.ok || !secret) {
          throw new Error(
            data?.error ||
              `Payment server returned HTTP ${res.status}. Please try again.`,
          );
        }

        const pk = (data.publishableKey || data.publishable_key) as
          | string
          | undefined;
        if (pk && /^pk_(live|test)_/.test(pk)) {
          setActiveStripe(getPaymentStripeForKey(pk));
        } else if (STRIPE_IS_CONFIGURED) {
          setActiveStripe(stripePromise);
        } else {
          throw new Error(
            'Card payments are not configured yet. Please contact support@refund-connect.com.',
          );
        }

        setClientSecret(secret);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || 'Failed to initialize payment.';
        setLoadError(msg);
        toast({
          title: 'Payment unavailable',
          description: msg,
          variant: 'destructive',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, metadata, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <div className="p-4 border rounded-lg bg-muted/40 text-sm text-muted-foreground">
            {loadError}
          </div>
        ) : !clientSecret || !activeStripe ? (
          <div className="p-4 text-sm text-muted-foreground">
            Loading secure payment form…
          </div>
        ) : (
          <Elements
            key={clientSecret}
            stripe={activeStripe}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <StripePaymentFields amount={amount} onSuccess={onSuccess} />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
};
