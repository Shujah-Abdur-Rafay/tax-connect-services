import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { createPromoCodeRecord } from '@/services/promoCodeService';
import { queueFirebaseEmail, buildBrandedEmail } from '@/services/firebaseEmailService';


const CRM_SUBSCRIBE_URL = 'https://famous.ai/api/crm/68a3939608e7f1e2bfd480c9/subscribe';

export interface ExitIntentLead {
  email: string;
  name?: string;
  offer: string;
  page: string;
  variant?: string;
  utm?: Record<string, string | null>;
  referrer?: string;
  userAgent?: string;
}

export interface ExitIntentLeadResult {
  crmOk: boolean;
  firestoreOk: boolean;
  promoEmailSent: boolean;
  promoCodeStored: boolean;
  promoCode?: string;
  promoAmount?: number;
  promoExpiresAt?: string;
  error?: string;
}

/**
 * Submits an exit-intent lead through the full pipeline:
 *   1) Famous CRM subscribe endpoint
 *   2) Firestore `exit_intent_leads` collection
 *   3) Supabase edge function `send-exit-intent-promo` (generates code + sends branded email)
 *   4) Firestore `promo_codes` collection (so checkout can validate / redeem)
 *
 * Step 3 + 4 only run if both step 1 and step 2 succeed, so we never email a
 * promo code without first having a record of the lead.
 */
export async function submitExitIntentLead(
  lead: ExitIntentLead
): Promise<ExitIntentLeadResult> {
  let crmOk = false;
  let firestoreOk = false;
  let promoEmailSent = false;
  let promoCodeStored = false;
  let promoCode: string | undefined;
  let promoAmount: number | undefined;
  let promoExpiresAt: string | undefined;
  let errorMsg: string | undefined;

  const appendError = (msg: string) => {
    errorMsg = errorMsg ? `${errorMsg}; ${msg}` : msg;
  };

  // ---- 1) CRM subscribe ---------------------------------------------------
  try {
    const res = await fetch(CRM_SUBSCRIBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: lead.email,
        name: lead.name || undefined,
        source: 'exit-intent-popup',
        tags: [
          'exit-intent',
          'join-platform',
          '50-off-promo',
          lead.variant ? `variant-${lead.variant}` : 'variant-none',
        ],
      }),
    });
    crmOk = res.ok;
    if (!res.ok) appendError(`CRM subscribe failed: ${res.status}`);
  } catch (err) {
    appendError(err instanceof Error ? err.message : 'CRM subscribe error');
  }

  // ---- 2) Firestore lead log ---------------------------------------------
  try {
    const utmParams: Record<string, string | null> = {};
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(
        (k) => {
          utmParams[k] = sp.get(k);
        }
      );
    }

    await addDoc(collection(db, 'exit_intent_leads'), {
      email: lead.email.toLowerCase().trim(),
      name: lead.name || null,
      offer: lead.offer,
      page: lead.page,
      variant: lead.variant || null,
      utm: lead.utm || utmParams,
      referrer:
        lead.referrer ||
        (typeof document !== 'undefined' ? document.referrer || null : null),
      userAgent:
        lead.userAgent ||
        (typeof navigator !== 'undefined' ? navigator.userAgent : null),
      crmSubscribed: crmOk,
      status: 'new',
      createdAt: serverTimestamp(),
    });
    firestoreOk = true;
  } catch (err) {
    appendError(err instanceof Error ? err.message : 'Firestore write error');
  }

  // ---- 3) Generate promo code, store it (4), then queue branded email -----
  // Fully Firebase: code is generated client-side, persisted to `promo_codes`,
  // and the email is queued via the Firebase Trigger-Email `mail` collection.
  // Soft-fail: any error here does not roll back the lead.
  if (firestoreOk) {
    try {
      const amount = 50;
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      const code = `SAVE50-${rand}`;
      const expiresDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const expiresAt = expiresDate.toISOString();

      promoCode = code;
      promoAmount = amount;
      promoExpiresAt = expiresAt;

      // 4) Persist the code so checkout can validate / redeem it.
      const stored = await createPromoCodeRecord({
        email: lead.email,
        code,
        amount,
        expiresAtIso: expiresAt,
        source: 'exit-intent-popup',
        variant: lead.variant ?? null,
      });
      promoCodeStored = stored.ok;
      if (!stored.ok && stored.error) {
        appendError(`Promo code Firestore write failed: ${stored.error}`);
      }

      // 3) Queue the branded promo email via Firebase Trigger Email.
      try {
        const html = buildBrandedEmail({
          title: `Here's your $${amount} discount`,
          intro: `${lead.name ? lead.name + ', t' : 'T'}hanks for your interest! Use the code below at checkout to take $${amount} off your membership.`,
          rows: [
            { label: 'Promo code', value: code },
            { label: 'Discount', value: `$${amount} off` },
            { label: 'Expires', value: expiresDate.toLocaleDateString() },
          ],
          ctaLabel: 'Claim my discount',
          ctaUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/join?promo=${encodeURIComponent(code)}`,
          footer: 'This code is valid for 7 days and can be used once.',
          accentColor: '#16a34a',
        });
        await queueFirebaseEmail({
          to: lead.email,
          subject: `Your $${amount} discount code: ${code}`,
          html,
          category: 'exit_intent_promo',
          meta: { code, amount, expiresAt, variant: lead.variant ?? null },
        });
        promoEmailSent = true;
      } catch (emailErr) {
        appendError(
          emailErr instanceof Error
            ? `Promo email queue failed: ${emailErr.message}`
            : 'Promo email queue failed'
        );
      }
    } catch (err) {
      appendError(
        err instanceof Error ? err.message : 'Promo generation failed'
      );
    }
  }


  return {
    crmOk,
    firestoreOk,
    promoEmailSent,
    promoCodeStored,
    promoCode,
    promoAmount,
    promoExpiresAt,
    error: errorMsg,
  };
}
