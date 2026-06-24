import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { emailNotificationService } from '@/services/emailNotificationService';
import { stripePromise, STRIPE_IS_CONFIGURED } from '@/lib/stripe';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Cache Stripe.js promises keyed by publishable key (returned by the Cloud
// Function) so card payments work even when VITE_STRIPE_PUBLISHABLE_KEY was
// never set at build time. Publishable keys are safe to expose in the browser.
const bookingStripeCache = new Map<string, Promise<Stripe | null>>();
function getBookingStripeForKey(pk: string): Promise<Stripe | null> {
  let p = bookingStripeCache.get(pk);
  if (!p) {
    p = loadStripe(pk);
    bookingStripeCache.set(pk, p);
  }
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Cloud Function endpoint that creates the Stripe PaymentIntent.
// Same function powers /pricing membership checkout — it's already deployed
// and verified, so booking deposits piggyback on the same battle-tested path.
// ─────────────────────────────────────────────────────────────────────────────
const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
  'refund-connect-1m30';
const CREATE_PAYMENT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/createTaxProPayment`;

interface PaymentFormProps {
  appointmentId: string;
  amount: number; // dollars
  professionalName: string;
  professionalEmail: string;
  /** Optional — included in PaymentIntent metadata so admin tooling can trace it back. */
  professionalId?: string;
  clientName: string;
  clientEmail: string;
  appointmentDate: string;
  startTime: string;
  serviceType: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Real Stripe Elements form. Confirms the PaymentIntent client-side, then
 * marks the appointment as paid+confirmed in Firestore and fires the
 * confirmation/receipt emails.
 */
const InnerStripeForm: React.FC<
  Pick<
    PaymentFormProps,
    | 'appointmentId'
    | 'amount'
    | 'professionalName'
    | 'clientName'
    | 'clientEmail'
    | 'appointmentDate'
    | 'startTime'
    | 'serviceType'
    | 'onSuccess'
    | 'onCancel'
  >
> = ({
  appointmentId,
  amount,
  professionalName,
  clientName,
  clientEmail,
  appointmentDate,
  startTime,
  serviceType,
  onSuccess,
  onCancel,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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
        description: error.message || 'Your card was not charged.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (paymentIntent?.status !== 'succeeded') {
      toast({
        title: 'Payment not completed',
        description: `Status: ${paymentIntent?.status ?? 'unknown'}`,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // ── Mark appointment paid in Firestore ───────────────────────────────
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        deposit_paid: true,
        status: 'confirmed',
        stripe_payment_intent_id: paymentIntent.id,
        paid_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } catch (dbErr) {
      console.error(
        '[BookingPaymentForm] Failed to update appointment after payment:',
        dbErr,
      );
    }

    // ── Fire confirmation + receipt emails (best effort) ─────────────────
    try {
      await emailNotificationService.notifyAppointmentBooked(
        clientEmail,
        clientName,
        professionalName,
        appointmentDate,
        startTime,
        serviceType,
        '60 minutes',
      );
    } catch (emailError) {
      console.error(
        '[BookingPaymentForm] Failed to send confirmation email:',
        emailError,
      );
    }
    try {
      await emailNotificationService.notifyPaymentProcessed(
        clientEmail,
        clientName,
        amount.toString(),
        serviceType,
        paymentIntent.id,
      );
    } catch (emailError) {
      console.error(
        '[BookingPaymentForm] Failed to send payment email:',
        emailError,
      );
    }

    toast({
      title: 'Payment successful',
      description: `Charged $${amount.toFixed(2)}. Your appointment is confirmed.`,
    });
    setLoading(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={!stripe || !elements || loading}
        >
          {loading ? 'Processing…' : `Pay $${amount.toFixed(2)}`}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Back
        </Button>
      </div>
    </form>
  );
};

const BookingPaymentForm: React.FC<PaymentFormProps> = (props) => {
  const {
    amount,
    appointmentId,
    clientEmail,
    clientName,
    serviceType,
    professionalId,
    professionalName,
  } = props;
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Stripe.js instance resolved at runtime from the publishable key the Cloud
  // Function returns (always matches the account that created the intent),
  // falling back to the build-time key. This is what makes card payments work
  // even when VITE_STRIPE_PUBLISHABLE_KEY was never set at build time.
  const [activeStripe, setActiveStripe] =
    useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setActiveStripe(null);
    setLoadError(null);

    (async () => {
      try {
        // Call the Firebase Cloud Function directly. We use the default
        // "membership" flow because appointment deposits are platform
        // charges (no Connect split — the platform holds the deposit and
        // refunds/credits it manually). Metadata captures the appointment
        // context so admin tools / webhooks can trace it.
        const res = await fetch(CREATE_PAYMENT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flow: 'membership',
            amount: Math.round(amount * 100),
            currency: 'usd',
            email: clientEmail,
            name: clientName,
            metadata: {
              purpose: 'appointment_deposit',
              appointment_id: appointmentId,
              client_email: clientEmail,
              client_name: clientName,
              service_type: serviceType,
              professional_id: professionalId || '',
              professional_name: professionalName || '',
            },
          }),
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          /* swallow — handled below */
        }
        if (cancelled) return;

        if (!res.ok || (!data?.clientSecret && !data?.client_secret)) {
          throw new Error(
            data?.error ||
              `Payment server returned HTTP ${res.status}. Please try again.`,
          );
        }

        // Resolve Stripe.js from the publishable key the function returns
        // (always matches the intent's account); fall back to the build-time key.
        const pk = (data.publishableKey || data.publishable_key) as
          | string
          | undefined;
        if (pk && /^pk_(live|test)_/.test(pk)) {
          setActiveStripe(getBookingStripeForKey(pk));
        } else if (STRIPE_IS_CONFIGURED) {
          setActiveStripe(stripePromise);
        } else {
          throw new Error(
            'Card payments are not configured yet. Please contact support@refund-connect.com to complete your booking.',
          );
        }

        const secret = (data.clientSecret || data.client_secret) as string;
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
  }, [
    amount,
    appointmentId,
    clientEmail,
    clientName,
    serviceType,
    professionalId,
    professionalName,
    toast,
  ]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Confirm Booking — ${amount.toFixed(2)} Deposit</CardTitle>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <div className="space-y-3">
            <div className="p-4 border rounded bg-muted/40 text-sm text-muted-foreground">
              {loadError}
            </div>
            <Button variant="outline" onClick={props.onCancel} className="w-full">
              Back
            </Button>
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
            <InnerStripeForm {...props} />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingPaymentForm;