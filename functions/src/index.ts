import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import Stripe from 'stripe';
import corsLib from 'cors';

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE SERVER-SIDE SECRETS  (READ THIS BEFORE DEPLOYING)
// ─────────────────────────────────────────────────────────────────────────────
// The Stripe secret key (sk_live_...) and webhook signing secret (whsec_...)
// are NEVER hardcoded in this repo. They are read at runtime from
// Firebase Functions config:
//
//     functions.config().stripe.secret          // sk_live_...
//     functions.config().stripe.webhook_secret  // whsec_...
//
// Set both with this single command (run from the repo root, after `firebase login`):
//
//     firebase functions:config:set \
//       stripe.secret="sk_live_XXXXXXXX" \
//       stripe.webhook_secret="whsec_XXXXXXXX"
//
// Then deploy so the new config takes effect:
//
//     firebase deploy --only functions
//
// Verify what is currently set with:
//
//     firebase functions:config:get
//
// For local emulator development you may instead export them as env vars:
//     export STRIPE_SECRET_KEY=sk_test_...
//     export STRIPE_WEBHOOK_SECRET=whsec_...
// The fallbacks below (process.env.STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)
// pick those up automatically. NEVER commit either value.
// ─────────────────────────────────────────────────────────────────────────────

const cors = corsLib({ origin: true });

// Initialize firebase-admin exactly once (safe across hot reloads / multiple functions)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// The EXACT Firebase Functions config key these functions read for the Stripe
// secret key (sk_live_… / sk_test_…). Defined once here so every place that
// reads it AND every diagnostic that reports it stay in lockstep. If this is
// ever renamed (e.g. to `stripe.secret_key`), update only this constant and
// the /admin/stripe-health page will automatically surface the correct
// `firebase functions:config:set <key>="…"` command.
const STRIPE_SECRET_CONFIG_KEY = 'stripe.secret';


const PLATFORM_BRAND = 'Refund Connect';
const PLATFORM_PRIMARY = '#2563eb';
const PLATFORM_ACCENT = '#10b981';

const templates = {
  'new-message': (d: any) => ({
    subject: `New message from ${d.senderName}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#2563eb;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0"><h1>New Message</h1></div><div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb"><p>Hi ${d.recipientName},</p><p>You have received a new message from <strong>${d.senderName}</strong>:</p><div style="background:white;padding:20px;margin:20px 0;border-left:4px solid #2563eb;border-radius:4px"><p>${d.messagePreview}</p></div><a href="${d.messageUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;margin:20px 0">View Message</a></div></body></html>`
  }),
  'booking-confirmation': (d: any) => ({
    subject: `Booking Confirmed with ${d.professionalName}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#10b981;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0"><h1>Booking Confirmed</h1></div><div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb"><p>Hi ${d.clientName},</p><div style="background:white;padding:20px;margin:20px 0;border-radius:8px"><p><strong>Professional:</strong> ${d.professionalName}</p><p><strong>Service:</strong> ${d.serviceName}</p><p><strong>Date:</strong> ${d.dateTime}</p><p><strong>Amount:</strong> $${d.amount}</p></div></div></body></html>`
  }),
  'profile-view': (d: any) => ({
    subject: `${d.viewerName} viewed your profile`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#8b5cf6;color:white;padding:30px;text-align:center"><h1>Profile View</h1></div><div style="padding:30px"><p>Hi ${d.professionalName},</p><p><strong>${d.viewerName}</strong> viewed your profile</p></div></body></html>`
  }),
  'weekly-digest': (d: any) => ({
    subject: `Weekly Summary - ${d.weekRange}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#f59e0b;color:white;padding:30px;text-align:center"><h1>Weekly Summary</h1></div><div style="padding:30px"><p>Hi ${d.userName},</p><p>Messages: ${d.newMessages || 0} | Views: ${d.profileViews || 0}</p></div></body></html>`
  }),

  // ─────────────────────────────────────────────────────────────────────
  // Membership purchase confirmation (sent TO the tax pro who just paid).
  // Branded, conversion-friendly, and includes their tier, amount,
  // Stripe receipt URL (if provided), onboarding next steps, and a link
  // to book their kickoff call.
  // Required fields on emailData:
  //   recipientEmail, recipientName, tierName, amountFormatted (e.g. "$299.95"),
  //   paymentIntentId
  // Optional:
  //   receiptUrl, kickoffCalendarUrl, dashboardUrl, supportEmail,
  //   purchasedAt (ISO string)
  // ─────────────────────────────────────────────────────────────────────
  'membership-welcome': (d: any) => {
    const dashUrl = d.dashboardUrl || 'https://refund-connect.com/member-portal';
    const calUrl = d.kickoffCalendarUrl || 'https://refund-connect.com/support';
    const supportEmail = d.supportEmail || 'support@refund-connect.com';
    const receiptBlock = d.receiptUrl
      ? `<a href="${d.receiptUrl}" style="color:${PLATFORM_PRIMARY};text-decoration:underline">View / download your Stripe receipt</a>`
      : `A detailed payment receipt is being emailed to you separately by Stripe.`;
    const purchasedAt = d.purchasedAt
      ? new Date(d.purchasedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
      : new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    return {
      subject: `Welcome to ${d.tierName} — your ${PLATFORM_BRAND} membership is active`,
      html: `<!DOCTYPE html>
<html><body style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;margin:0;padding:0">
  <div style="max-width:640px;margin:0 auto;background:#ffffff">
    <div style="background:linear-gradient(135deg,${PLATFORM_PRIMARY} 0%,#1e40af 100%);color:#ffffff;padding:40px 32px;text-align:center">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);padding:6px 14px;border-radius:999px;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:18px">Payment confirmed</div>
      <h1 style="margin:0;font-size:30px;line-height:1.2;font-weight:700">Welcome to ${d.tierName}!</h1>
      <p style="margin:12px 0 0;font-size:16px;opacity:0.95">Your ${PLATFORM_BRAND} membership is live.</p>
    </div>

    <div style="padding:32px">
      <p style="font-size:16px;color:#111827;margin:0 0 16px">Hi ${d.recipientName || 'there'},</p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px">Thank you for upgrading. Your payment has been processed and your ${d.tierName} benefits are unlocked immediately. Here are the details for your records:</p>

      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:6px;margin-bottom:24px">
        <tr><td style="padding:14px 18px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.5px">Tier</td><td style="padding:14px 18px;color:#111827;font-size:15px;font-weight:600;text-align:right">${d.tierName}</td></tr>
        <tr><td style="padding:14px 18px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #e5e7eb">Amount paid</td><td style="padding:14px 18px;color:${PLATFORM_ACCENT};font-size:18px;font-weight:700;text-align:right;border-top:1px solid #e5e7eb">${d.amountFormatted}</td></tr>
        <tr><td style="padding:14px 18px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #e5e7eb">Date</td><td style="padding:14px 18px;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb">${purchasedAt}</td></tr>
        <tr><td style="padding:14px 18px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #e5e7eb">Reference</td><td style="padding:14px 18px;color:#6b7280;font-size:12px;font-family:monospace;text-align:right;border-top:1px solid #e5e7eb">${d.paymentIntentId || 'n/a'}</td></tr>
      </table>

      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 28px">${receiptBlock}</p>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:22px;margin-bottom:28px">
        <h2 style="margin:0 0 14px;font-size:18px;color:#1e3a8a">Your next 3 steps</h2>
        <ol style="margin:0;padding-left:22px;color:#1f2937;font-size:14px;line-height:1.7">
          <li><strong>Complete your profile.</strong> Add your photo, services, pricing, and credentials so clients can find and book you.</li>
          <li><strong>Connect Stripe payouts.</strong> Finish the Stripe Express onboarding so client payments land in your bank account automatically.</li>
          <li><strong>Book your kickoff call.</strong> A short onboarding call with our team gets your listing live and ranking faster.</li>
        </ol>
      </div>

      <div style="text-align:center;margin:0 0 28px">
        <a href="${calUrl}" style="display:inline-block;background:${PLATFORM_ACCENT};color:#ffffff;padding:14px 28px;font-size:15px;font-weight:600;border-radius:8px;text-decoration:none;margin:0 6px 10px">Book your kickoff call</a>
        <a href="${dashUrl}" style="display:inline-block;background:${PLATFORM_PRIMARY};color:#ffffff;padding:14px 28px;font-size:15px;font-weight:600;border-radius:8px;text-decoration:none;margin:0 6px 10px">Go to your dashboard</a>
      </div>

      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 6px">Questions? Just reply to this email or reach us at <a href="mailto:${supportEmail}" style="color:${PLATFORM_PRIMARY}">${supportEmail}</a>. We read every message.</p>
      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0">Welcome to the team,<br/>The ${PLATFORM_BRAND} crew</p>
    </div>

    <div style="background:#111827;color:#9ca3af;padding:18px 32px;text-align:center;font-size:12px">
      © ${new Date().getFullYear()} ${PLATFORM_BRAND}. This receipt was generated automatically when your payment cleared.
    </div>
  </div>
</body></html>`
    };
  },

  // ─────────────────────────────────────────────────────────────────────
  // Internal sale notification (sent TO the platform owner the moment a
  // tax pro converts). Designed to be scannable on mobile.
  // Required fields:
  //   recipientEmail (the owner), tierName, amountFormatted, paymentIntentId,
  //   proName, proEmail
  // Optional:
  //   proPhone, promoCode, promoAmountFormatted, attemptDocId,
  //   stripeDashboardUrl, adminContactsUrl
  // ─────────────────────────────────────────────────────────────────────
  'membership-sale-internal': (d: any) => {
    const stripeDash = d.stripeDashboardUrl
      || (d.paymentIntentId
            ? `https://dashboard.stripe.com/payments/${d.paymentIntentId}`
            : 'https://dashboard.stripe.com/payments');
    const adminUrl = d.adminContactsUrl || 'https://refund-connect.com/admin/crm-contacts';
    const promoRow = d.promoCode
      ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;border-top:1px solid #e5e7eb">Promo used</td><td style="padding:10px 16px;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb">${d.promoCode}${d.promoAmountFormatted ? ` (−${d.promoAmountFormatted})` : ''}</td></tr>`
      : '';
    const phoneRow = d.proPhone
      ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;border-top:1px solid #e5e7eb">Phone</td><td style="padding:10px 16px;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb"><a href="tel:${d.proPhone}" style="color:#111827;text-decoration:none">${d.proPhone}</a></td></tr>`
      : '';
    return {
      subject: `[SALE] ${d.amountFormatted} · ${d.tierName} · ${d.proName || d.proEmail}`,
      html: `<!DOCTYPE html>
<html><body style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:${PLATFORM_ACCENT};color:#ffffff;padding:22px 28px">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85">New sale</div>
      <div style="font-size:28px;font-weight:800;margin-top:4px">${d.amountFormatted}</div>
      <div style="font-size:14px;margin-top:2px;opacity:0.95">${d.tierName}</div>
    </div>

    <div style="padding:24px 28px">
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
        <tr><td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase">Name</td><td style="padding:10px 16px;color:#111827;font-size:14px;text-align:right;font-weight:600">${d.proName || '—'}</td></tr>
        <tr><td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;border-top:1px solid #e5e7eb">Email</td><td style="padding:10px 16px;color:#111827;font-size:14px;text-align:right;border-top:1px solid #e5e7eb"><a href="mailto:${d.proEmail}" style="color:${PLATFORM_PRIMARY};text-decoration:none">${d.proEmail}</a></td></tr>
        ${phoneRow}
        ${promoRow}
        <tr><td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;border-top:1px solid #e5e7eb">Payment ID</td><td style="padding:10px 16px;color:#6b7280;font-size:11px;font-family:monospace;text-align:right;border-top:1px solid #e5e7eb">${d.paymentIntentId || 'n/a'}</td></tr>
        <tr><td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;border-top:1px solid #e5e7eb">Attempt log</td><td style="padding:10px 16px;color:#6b7280;font-size:11px;font-family:monospace;text-align:right;border-top:1px solid #e5e7eb">${d.attemptDocId || 'n/a'}</td></tr>
        <tr><td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;border-top:1px solid #e5e7eb">When</td><td style="padding:10px 16px;color:#111827;font-size:13px;text-align:right;border-top:1px solid #e5e7eb">${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
      </table>

      <div style="text-align:center;margin-top:20px">
        <a href="${stripeDash}" style="display:inline-block;background:${PLATFORM_PRIMARY};color:#ffffff;padding:10px 18px;font-size:13px;font-weight:600;border-radius:6px;text-decoration:none;margin:0 4px 8px">View in Stripe</a>
        <a href="${adminUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 18px;font-size:13px;font-weight:600;border-radius:6px;text-decoration:none;margin:0 4px 8px">Open CRM</a>
      </div>

      <p style="font-size:12px;color:#6b7280;margin-top:18px;text-align:center">Automated alert from <strong>${PLATFORM_BRAND}</strong>. Payment cleared and Firestore was flipped to the new tier.</p>
    </div>
  </div>
</body></html>`
    };
  }
};

export const sendEmail = functions.https.onCall(async (data, context) => {
  const { type, emailData } = data || ({} as any);

  const gmailUser = functions.config().gmail?.user || process.env.GMAIL_USER;
  const gmailPassword = functions.config().gmail?.password || process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    throw new functions.https.HttpsError('failed-precondition', 'Gmail credentials not configured');
  }

  const template = templates[type as keyof typeof templates];
  if (!template) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown notification type: ${type}`);
  }

  if (!emailData?.recipientEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'emailData.recipientEmail is required');
  }

  const { subject, html } = template(emailData);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPassword }
  });

  try {
    await transporter.sendMail({
      from: `${PLATFORM_BRAND} <${gmailUser}>`,
      to: emailData.recipientEmail,
      // Optional fields for transactional emails:
      ...(emailData.replyTo ? { replyTo: emailData.replyTo } : {}),
      ...(emailData.bcc ? { bcc: emailData.bcc } : {}),
      subject,
      html
    });

    return { success: true, message: 'Email sent successfully', type };
  } catch (error: any) {
    console.error('Email error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * getPaymentReceipt
 *
 * Read-only HTTPS function that returns the public Stripe receipt_url for a
 * PaymentIntent. We need a small server endpoint because the receipt URL
 * lives on the latest Charge (not on the PaymentIntent the client can see
 * via Stripe.js), and we don't want to ship the Stripe secret to the
 * browser.
 *
 * Used by the frontend post-purchase email flow so the welcome email links
 * the new member directly to their official Stripe receipt PDF.
 *
 * Request (POST JSON): { paymentIntentId: string }
 * Response:            { success: true, receiptUrl: string|null, paid: boolean }
 */
export const getPaymentReceipt = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
        return;
      }
      const stripeSecret =
        functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret) {
        res.status(500).json({ success: false, error: 'Stripe not configured.' });
        return;
      }
      const stripe = new Stripe(stripeSecret, {
        apiVersion: '2023-10-16',
        typescript: true,
      });

      const { paymentIntentId } = (req.body || {}) as { paymentIntentId?: string };
      if (!paymentIntentId) {
        res.status(400).json({ success: false, error: 'Missing paymentIntentId.' });
        return;
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
      });
      const charge =
        pi.latest_charge && typeof pi.latest_charge === 'object'
          ? (pi.latest_charge as Stripe.Charge)
          : null;
      const receiptUrl = charge?.receipt_url || null;

      res.status(200).json({
        success: true,
        paymentIntentId: pi.id,
        paid: pi.status === 'succeeded',
        receiptUrl,
      });
    } catch (err: any) {
      console.error('[getPaymentReceipt] Error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to look up receipt.',
      });
    }
  });
});


/**
 * createTaxProPayment
 *
 * HTTPS Cloud Function that creates a Stripe PaymentIntent. Originally built
 * for tax-pro MEMBERSHIP signups (charges land on the platform account), it
 * now also supports CONNECT DESTINATION CHARGES for client → pro gig
 * payments. The two modes are dispatched by the `flow` field:
 *
 *   flow = "membership"  (default — backwards compatible)
 *     Creates a PaymentIntent on the platform account for a membership
 *     purchase. Funds settle to the platform; no transfer happens.
 *
 *   flow = "gig"
 *     Creates a DESTINATION CHARGE for a client-paid gig/booking:
 *       transfer_data[destination] = <pro's Firestore stripe_account_id>
 *       application_fee_amount     = 20% of `amount` (default — overridable
 *                                    via applicationFeePercent in [0,100])
 *     The platform keeps the 20% application fee; Stripe automatically
 *     credits the remaining 80% to the pro's connected Stripe balance.
 *
 *     HARD GATE: if the professional doc has
 *     `stripe_charges_enabled !== true` OR no `stripe_account_id`,
 *     checkout is BLOCKED with HTTP 400 `PRO_NOT_CONNECTED` and a
 *     clear human-readable message. We never silently fall back to a
 *     platform charge for gig payments — that would collect money the
 *     pro cannot withdraw.
 *
 * Request (POST JSON):
 *   {
 *     flow?: "membership" | "gig",        // default "membership"
 *     amount: number,                     // REQUIRED, in cents. Min 50.
 *     currency?: string,                  // default "usd"
 *     email?: string,                     // receipt_email
 *     name?: string,                      // metadata only
 *     // --- membership flow ---
 *     membershipTier?: string,
 *     professionalId?: string,            // pro buying membership
 *     // --- gig flow ---
 *     proId?: string,                     // pro RECEIVING the payment (Firestore professionals/{proId})
 *     orderId?: string,                   // gig_orders/{orderId}
 *     applicationFeePercent?: number,     // default 20
 *     metadata?: Record<string,string>
 *   }
 *
 * Response (200 JSON):
 *   {
 *     success: true,
 *     clientSecret: string,
 *     paymentIntentId: string,
 *     amount: number,
 *     currency: string,
 *     flow: "membership" | "gig",
 *     // present on flow === "gig":
 *     destinationAccountId?: string,
 *     applicationFeeAmount?: number,
 *     applicationFeePercent?: number
 *   }
 */
export const createTaxProPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
        return;
      }

      // Read the secret via the SAME key path we report to the diagnostic
      // page, so the two can never drift apart. STRIPE_SECRET_CONFIG_KEY is the
      // single source of truth (e.g. "stripe.secret").
      const cfg = functions.config() as Record<string, any>;
      const [cfgNamespace, cfgField] = STRIPE_SECRET_CONFIG_KEY.split('.');
      const stripeSecret =
        cfg?.[cfgNamespace]?.[cfgField] || process.env.STRIPE_SECRET_KEY;

      if (!stripeSecret) {
        console.error(
          `Stripe secret key is not configured (expected Firebase config key "${STRIPE_SECRET_CONFIG_KEY}").`
        );
        res.status(500).json({
          success: false,
          // `configKey` lets the /admin/stripe-health 500 fix panel render the
          // exact `firebase functions:config:set <key>="…"` command for THIS
          // project's setup instead of a hardcoded guess.
          configKey: STRIPE_SECRET_CONFIG_KEY,
          error:
            'Stripe is not configured on the server. Set it with: ' +
            `firebase functions:config:set ${STRIPE_SECRET_CONFIG_KEY}="sk_live_..."`,
        });
        return;
      }

      const stripe = new Stripe(stripeSecret, {
        apiVersion: '2023-10-16',
        typescript: true,
      });

      // Publishable key that MATCHES this secret key's account. We return it
      // in every response so the frontend can load Stripe.js with the correct
      // account key even when VITE_STRIPE_PUBLISHABLE_KEY was never set at
      // build time (the root cause of the "Card payments are not configured"
      // message). Publishable keys are safe to expose to the browser.
      const publishableKey =
        functions.config().stripe?.publishable ||
        functions.config().stripe?.publishable_key ||
        process.env.STRIPE_PUBLISHABLE_KEY ||
        null;


      const {
        flow = 'membership',
        amount,
        currency = 'usd',
        email,
        name,
        membershipTier,
        professionalId,
        proId,
        orderId,
        applicationFeePercent,
        metadata = {},
      } = (req.body || {}) as {
        flow?: 'membership' | 'gig';
        amount?: number;
        currency?: string;
        email?: string;
        name?: string;
        membershipTier?: string;
        professionalId?: string;
        proId?: string;
        orderId?: string;
        applicationFeePercent?: number;
        metadata?: Record<string, string>;
      };

      if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        res.status(400).json({
          success: false,
          error: 'Invalid request: "amount" (number, in cents) is required.',
        });
        return;
      }
      if (amount < 50) {
        res.status(400).json({
          success: false,
          error: 'Amount must be at least 50 (cents). Stripe minimum charge is $0.50.',
        });
        return;
      }
      if (typeof currency !== 'string' || currency.length !== 3) {
        res.status(400).json({
          success: false,
          error: 'Invalid currency. Use a 3-letter ISO code (e.g. "usd").',
        });
        return;
      }

      // ── GIG (DESTINATION CHARGE) FLOW ──────────────────────────────────
      if (flow === 'gig') {
        if (!proId) {
          res.status(400).json({
            success: false,
            error: 'Gig payments require "proId" (the receiving professional).',
          });
          return;
        }

        // Load the pro's Connect state from Firestore. We treat this doc
        // as authoritative — Stripe's account capability flags are mirrored
        // here by the stripeConnect.status action.
        let proSnap;
        try {
          proSnap = await db.collection('professionals').doc(proId).get();
        } catch (e: any) {
          console.error(`[createTaxProPayment] Firestore read failed for proId=${proId}`, e);
          res.status(500).json({
            success: false,
            error: 'Could not load the receiving professional record.',
          });
          return;
        }
        if (!proSnap.exists) {
          res.status(404).json({
            success: false,
            error: `Professional ${proId} not found.`,
          });
          return;
        }
        const proData = proSnap.data() || {};
        const destinationAccountId: string | undefined =
          typeof proData.stripe_account_id === 'string'
            ? proData.stripe_account_id
            : undefined;
        const chargesEnabled = proData.stripe_charges_enabled === true;

        if (!destinationAccountId || !destinationAccountId.startsWith('acct_')) {
          res.status(400).json({
            success: false,
            code: 'PRO_NOT_CONNECTED',
            error:
              'This professional has not connected a Stripe account yet. ' +
              'They need to finish Connect Express onboarding before clients can pay them on the platform.',
          });
          return;
        }
        if (!chargesEnabled) {
          res.status(400).json({
            success: false,
            code: 'PRO_CHARGES_DISABLED',
            error:
              'This professional started Stripe onboarding but has not finished it ' +
              '(stripe_charges_enabled is false). Checkout is blocked until they ' +
              'complete the remaining requirements in the Stripe Express dashboard.',
          });
          return;
        }


        // Resolve fee percent. Priority:
        //   1. Per-request override in body (clamped to [0,100]).
        //   2. Firestore `platform_settings/fees`.applicationFeePercent
        //      (set by admin at /admin/platform-fees, no redeploy needed).
        //   3. Hardcoded 20% as last-resort fallback.
        const rawPct = Number(applicationFeePercent);
        let feePct: number;
        if (Number.isFinite(rawPct) && rawPct >= 0 && rawPct <= 100) {
          feePct = rawPct;
        } else {
          try {
            const settingsSnap = await db
              .collection('platform_settings')
              .doc('fees')
              .get();
            const stored = Number(
              settingsSnap.exists ? settingsSnap.data()?.applicationFeePercent : NaN
            );
            feePct =
              Number.isFinite(stored) && stored >= 0 && stored <= 100
                ? stored
                : 20;
          } catch (e) {
            console.warn(
              '[createTaxProPayment] failed to read platform_settings/fees, falling back to 20%',
              e
            );
            feePct = 20;
          }
        }
        const applicationFeeAmount = Math.max(
          0,
          Math.floor(Math.round(amount) * (feePct / 100))
        );


        const piMetadata: Record<string, string> = {
          purpose: 'gig_payment',
          flow: 'gig',
          proId,
          destination_account: destinationAccountId,
          application_fee_percent: String(feePct),
          ...(orderId ? { orderId } : {}),
          ...(name ? { client_name: name } : {}),
        };
        for (const [k, v] of Object.entries(metadata)) {
          if (v != null) piMetadata[k] = String(v);
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount),
          currency: currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          description: orderId
            ? `Refund Connect gig order ${orderId}`
            : 'Refund Connect gig payment',
          ...(email ? { receipt_email: email } : {}),
          // ── Destination charge ──────────────────────────────────────
          transfer_data: { destination: destinationAccountId },
          ...(applicationFeeAmount > 0
            ? { application_fee_amount: applicationFeeAmount }
            : {}),
          metadata: piMetadata,
        });

        console.log(
          `[createTaxProPayment][gig] PI ${paymentIntent.id} amount=${amount} fee=${applicationFeeAmount} destination=${destinationAccountId}`
        );

        res.status(200).json({
          success: true,
          flow: 'gig',
          publishableKey,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          destinationAccountId,
          applicationFeeAmount,
          applicationFeePercent: feePct,
          netToPro: Math.max(0, paymentIntent.amount - applicationFeeAmount),
        });
        return;
      }

      // ── MEMBERSHIP FLOW (default, backwards compatible) ───────────────
      const piMetadata: Record<string, string> = {
        purpose: 'tax_pro_membership',
        flow: 'membership',
        ...(membershipTier ? { membership_tier: membershipTier } : {}),
        ...(professionalId ? { professional_id: professionalId } : {}),
        ...(name ? { tax_pro_name: name } : {}),
      };
      for (const [k, v] of Object.entries(metadata)) {
        if (v != null) piMetadata[k] = String(v);
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        description: membershipTier
          ? `Tax Pro Membership – ${membershipTier}`
          : 'Tax Pro Membership Signup',
        ...(email ? { receipt_email: email } : {}),
        metadata: piMetadata,
      });

      console.log(
        `[createTaxProPayment][membership] PI ${paymentIntent.id} for ${amount} ${currency}`
      );

      res.status(200).json({
        success: true,
        flow: 'membership',
        publishableKey,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } catch (err: any) {
      console.error('[createTaxProPayment] Error:', err);

      if (err?.type && typeof err.type === 'string' && err.type.startsWith('Stripe')) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: err.message || 'Stripe error',
          code: err.code,
          type: err.type,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: err?.message || 'Internal server error creating PaymentIntent.',
      });
    }
  });
});


/**
 * verifyPaymentSplit
 *
 * Read-only HTTPS Cloud Function used by the /admin/payment-split-test page
 * to confirm a real Stripe payment was created as a destination charge with
 * the correct 80/20 split. Retrieves the PaymentIntent + its latest charge,
 * decodes the destination + application_fee_amount, and returns a structured
 * pass/fail report.
 *
 * Request (POST JSON):
 *   { paymentIntentId: string }
 *
 * Response (200 JSON):
 *   {
 *     success: true,
 *     paymentIntentId, chargeId, status,
 *     amount, currency,
 *     applicationFeeAmount, applicationFeePercent, expectedFeePercent,
 *     destinationAccountId, transferId,
 *     netToPro,
 *     splitOk: boolean,
 *     issues: string[],
 *     metadata
 *   }
 */
export const verifyPaymentSplit = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
        return;
      }

      const stripeSecret =
        functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret) {
        res.status(500).json({
          success: false,
          error: 'Stripe is not configured on the server.',
        });
        return;
      }
      const stripe = new Stripe(stripeSecret, {
        apiVersion: '2023-10-16',
        typescript: true,
      });

      const { paymentIntentId } = (req.body || {}) as { paymentIntentId?: string };
      if (!paymentIntentId || typeof paymentIntentId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Missing paymentIntentId.',
        });
        return;
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge', 'latest_charge.application_fee', 'latest_charge.transfer'],
      });

      const charge =
        pi.latest_charge && typeof pi.latest_charge === 'object'
          ? (pi.latest_charge as Stripe.Charge)
          : null;
      const transfer =
        charge?.transfer && typeof charge.transfer === 'object'
          ? (charge.transfer as Stripe.Transfer)
          : null;
      const applicationFee =
        charge?.application_fee && typeof charge.application_fee === 'object'
          ? (charge.application_fee as Stripe.ApplicationFee)
          : null;

      const amount = Number(pi.amount || 0);
      const applicationFeeAmount = Number(
        (charge && (charge as any).application_fee_amount) ??
          applicationFee?.amount ??
          (pi as any).application_fee_amount ??
          0
      );
      const destinationAccountId =
        ((pi as any).transfer_data?.destination as string | undefined) ||
        ((charge as any)?.destination as string | undefined) ||
        (transfer?.destination as string | undefined) ||
        null;
      const transferId =
        (typeof charge?.transfer === 'string' ? charge.transfer : transfer?.id) || null;
      const netToPro = Math.max(0, amount - applicationFeeAmount);
      const applicationFeePercent =
        amount > 0 ? Number(((applicationFeeAmount / amount) * 100).toFixed(2)) : 0;
      const expectedFeePercent = 20;

      const issues: string[] = [];
      if (pi.status !== 'succeeded')
        issues.push(`PaymentIntent status is "${pi.status}", expected "succeeded".`);
      if (!destinationAccountId)
        issues.push('No destination account found on the charge.');
      if (applicationFeeAmount <= 0)
        issues.push('application_fee_amount is 0 — platform did not collect a fee.');
      if (amount > 0 && Math.abs(applicationFeePercent - expectedFeePercent) > 1) {
        issues.push(
          `Fee percent is ${applicationFeePercent}%, expected ~${expectedFeePercent}%.`
        );
      }

      res.status(200).json({
        success: true,
        paymentIntentId: pi.id,
        chargeId: charge?.id || null,
        status: pi.status,
        amount,
        currency: pi.currency || 'usd',
        applicationFeeAmount,
        applicationFeePercent,
        expectedFeePercent,
        destinationAccountId,
        transferId,
        netToPro,
        splitOk: issues.length === 0,
        issues,
        metadata: pi.metadata || {},
      });
    } catch (err: any) {
      console.error('[verifyPaymentSplit] Error:', err);
      if (err?.type && typeof err.type === 'string' && err.type.startsWith('Stripe')) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: err.message || 'Stripe error',
          code: err.code,
          type: err.type,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: err?.message || 'Internal server error verifying payment split.',
      });
    }
  });
});



/**
 * stripeWebhook
 *
 * Receives Stripe webhook events and updates Firestore to reflect the current
 * membership / payment state of the corresponding tax professional.
 *
 * Setup:
 *   1. Create a webhook endpoint in the Stripe Dashboard pointing at this function's URL.
 *      (Get the URL after first deploy: firebase deploy --only functions:stripeWebhook)
 *   2. Subscribe at least these events:
 *        - payment_intent.succeeded
 *        - payment_intent.payment_failed
 *        - customer.subscription.updated
 *        - customer.subscription.deleted
 *   3. Copy the "Signing secret" (whsec_...) from the dashboard and set:
 *        firebase functions:config:set stripe.webhook_secret="whsec_..."
 *      (also requires stripe.secret to already be set from createTaxProPayment).
 *
 * Raw body handling:
 *   Stripe signature verification requires the EXACT raw request bytes.
 *   firebase-functions exposes those bytes on `req.rawBody` for HTTPS functions,
 *   so we use that directly with `stripe.webhooks.constructEvent` and do NOT run
 *   any CORS / body-parsing middleware before it (which would mutate the body).
 *
 * Firestore updates (collection: `professionals`):
 *   - payment_intent.succeeded         -> { paymentStatus: 'paid', membershipTier: <metadata.membership_tier>, membershipStatus: 'active', ... }
 *   - payment_intent.payment_failed    -> { paymentStatus: 'failed', lastPaymentError: <msg>, ... }
 *   - customer.subscription.updated    -> { subscriptionStatus, membershipStatus, currentPeriodEnd, cancelAtPeriodEnd, ... }
 *   - customer.subscription.deleted    -> { subscriptionStatus: 'canceled', membershipStatus: 'inactive', membershipTier: 'free', ... }
 *
 * The professional doc is located via metadata.professional_id on the PaymentIntent /
 * Subscription. If it's missing we log a warning and ack the event (200) so Stripe
 * does not retry indefinitely.
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  // Stripe always POSTs webhooks
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const stripeSecret =
    functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY;
  const webhookSecret =
    functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret) {
    console.error('[stripeWebhook] Stripe secret key not configured.');
    res.status(500).send('Stripe secret not configured');
    return;
  }
  if (!webhookSecret) {
    console.error('[stripeWebhook] Stripe webhook secret not configured.');
    res
      .status(500)
      .send(
        'Webhook secret not configured. Run: firebase functions:config:set stripe.webhook_secret="whsec_..."'
      );
    return;
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2023-10-16',
    typescript: true,
  });

  const signature = req.headers['stripe-signature'] as string | undefined;
  if (!signature) {
    console.warn('[stripeWebhook] Missing Stripe-Signature header.');
    res.status(400).send('Missing Stripe-Signature header');
    return;
  }

  // firebase-functions exposes the raw request body bytes here. This is the
  // *only* representation that will pass Stripe signature verification — do
  // NOT use req.body (which is already JSON-parsed).
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    console.error('[stripeWebhook] req.rawBody is unavailable.');
    res.status(400).send('Raw body unavailable');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripeWebhook] Signature verification failed:', err?.message);
    res.status(400).send(`Webhook signature verification failed: ${err?.message}`);
    return;
  }

  console.log(`[stripeWebhook] Received event ${event.id} (${event.type})`);

  // ── AUDIT LOG ─────────────────────────────────────────────────────────
  // Mirror every signed event into Firestore so the /admin/stripe-health
  // diagnostic page can prove the webhook endpoint is actually receiving
  // events from Stripe (the #1 silent-failure mode for membership flows).
  // We do this BEFORE running the handler so a handler crash doesn't hide
  // the fact that the event arrived.
  const auditRef = db.collection('stripe_webhook_events').doc(event.id);
  try {
    await auditRef.set(
      {
        eventId: event.id,
        type: event.type,
        livemode: !!event.livemode,
        apiVersion: event.api_version || null,
        createdAt: admin.firestore.Timestamp.fromMillis((event.created || 0) * 1000),
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        objectId:
          (event.data?.object as any)?.id ||
          null,
        objectType:
          (event.data?.object as any)?.object ||
          null,
        amount: (event.data?.object as any)?.amount || null,
        currency: (event.data?.object as any)?.currency || null,
        metadata: (event.data?.object as any)?.metadata || null,
        handled: false,
      },
      { merge: true }
    );
  } catch (e: any) {
    console.warn('[stripeWebhook] could not write audit log row:', e?.message);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(pi);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(pi);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
      default:
        console.log(`[stripeWebhook] Unhandled event type: ${event.type}`);
    }

    // Mark the audit row as successfully handled.
    try {
      await auditRef.set(
        {
          handled: true,
          handledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (_e) {
      /* non-fatal */
    }

    // Always 200 on successful processing so Stripe doesn't retry.
    res.status(200).json({ received: true, type: event.type, id: event.id });
  } catch (err: any) {
    console.error(`[stripeWebhook] Handler error for ${event.type}:`, err);
    // Mark the audit row as failed so the health page can surface it.
    try {
      await auditRef.set(
        {
          handled: false,
          handlerError: String(err?.message || err || 'handler error'),
          handlerFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (_e) {
      /* non-fatal */
    }
    // 500 tells Stripe to retry with exponential backoff.
    res.status(500).json({ received: false, error: err?.message || 'Handler error' });
  }
});


/**
 * Resolves the Firestore `professionals/{id}` doc reference from a metadata bag.
 * Returns null if no professional_id is present (caller should log + skip).
 */
function professionalRefFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): FirebaseFirestore.DocumentReference | null {
  const professionalId = metadata?.professional_id;
  if (!professionalId) return null;
  return db.collection('professionals').doc(professionalId);
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const ref = professionalRefFromMetadata(pi.metadata);
  if (!ref) {
    console.warn(
      `[stripeWebhook] payment_intent.succeeded ${pi.id} has no metadata.professional_id; skipping Firestore update.`
    );
    return;
  }

  const membershipTier = pi.metadata?.membership_tier || null;

  const update: Record<string, any> = {
    paymentStatus: 'paid',
    membershipStatus: 'active',
    lastPaymentIntentId: pi.id,
    lastPaymentAmount: pi.amount,
    lastPaymentCurrency: pi.currency,
    lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
    lastPaymentError: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (membershipTier) {
    update.membershipTier = membershipTier;
  }
  if (pi.customer && typeof pi.customer === 'string') {
    update.stripeCustomerId = pi.customer;
  }

  await ref.set(update, { merge: true });
  console.log(
    `[stripeWebhook] Updated professionals/${ref.id} -> paid${
      membershipTier ? ` (tier=${membershipTier})` : ''
    }`
  );
}

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const ref = professionalRefFromMetadata(pi.metadata);
  if (!ref) {
    console.warn(
      `[stripeWebhook] payment_intent.payment_failed ${pi.id} has no metadata.professional_id; skipping Firestore update.`
    );
    return;
  }

  const errorMessage =
    pi.last_payment_error?.message ||
    pi.last_payment_error?.code ||
    'Payment failed';

  await ref.set(
    {
      paymentStatus: 'failed',
      membershipStatus: 'payment_failed',
      lastPaymentIntentId: pi.id,
      lastPaymentError: errorMessage,
      lastPaymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(
    `[stripeWebhook] Updated professionals/${ref.id} -> failed (${errorMessage})`
  );
}

/**
 * Stripe subscription -> internal membership status mapping.
 */
function membershipStatusFromSubscription(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'inactive';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    case 'paused':
      return 'paused';
    default:
      return String(status);
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const ref = professionalRefFromMetadata(sub.metadata);
  if (!ref) {
    console.warn(
      `[stripeWebhook] customer.subscription.updated ${sub.id} has no metadata.professional_id; skipping Firestore update.`
    );
    return;
  }

  const membershipTier = sub.metadata?.membership_tier || null;
  const membershipStatus = membershipStatusFromSubscription(sub.status);

  const update: Record<string, any> = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    membershipStatus,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodStart: sub.current_period_start
      ? admin.firestore.Timestamp.fromMillis(sub.current_period_start * 1000)
      : null,
    currentPeriodEnd: sub.current_period_end
      ? admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000)
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (membershipTier) {
    update.membershipTier = membershipTier;
  }
  if (sub.customer && typeof sub.customer === 'string') {
    update.stripeCustomerId = sub.customer;
  }
  // Reflect "paid" on the doc when subscription is active/trialing, otherwise leave paymentStatus alone.
  if (sub.status === 'active' || sub.status === 'trialing') {
    update.paymentStatus = 'paid';
  } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
    update.paymentStatus = 'past_due';
  }

  await ref.set(update, { merge: true });
  console.log(
    `[stripeWebhook] Updated professionals/${ref.id} -> subscription ${sub.status} (membership=${membershipStatus})`
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const ref = professionalRefFromMetadata(sub.metadata);
  if (!ref) {
    console.warn(
      `[stripeWebhook] customer.subscription.deleted ${sub.id} has no metadata.professional_id; skipping Firestore update.`
    );
    return;
  }

  await ref.set(
    {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: 'canceled',
      membershipStatus: 'inactive',
      membershipTier: 'free',
      paymentStatus: 'canceled',
      cancelAtPeriodEnd: false,
      canceledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(
    `[stripeWebhook] Updated professionals/${ref.id} -> subscription canceled (membership=inactive)`
  );
}


/**
 * stripeConnect
 *
 * HTTPS Cloud Function that manages Stripe Connect Express accounts for tax
 * professionals so they can receive payouts on their connected bank accounts.
 *
 * This is a single multi-action endpoint dispatched by `action` in the JSON body:
 *
 *   POST { action: "onboard", proId, email?, name?, country?, refreshUrl, returnUrl, existingAccountId? }
 *     → Creates an Express account (or reuses an existing one) and returns an
 *       AccountLink URL the pro opens to complete hosted onboarding. Persists
 *       `stripe_account_id` onto professionals/{proId} immediately so the
 *       same account is reused on resume.
 *     ← { accountId, onboardingUrl, expiresAt }
 *
 *   POST { action: "status", proId, accountId }
 *     → Retrieves live account state from Stripe and syncs the capability
 *       booleans (charges_enabled / payouts_enabled / details_submitted)
 *       onto professionals/{proId}.
 *     ← { accountId, chargesEnabled, payoutsEnabled, detailsSubmitted, requirements, ... }
 *
 *   POST { action: "dashboard", accountId }
 *     → Returns account summary + live balance + last 10 payouts + a single-
 *       use Stripe Express dashboard login URL.
 *     ← { account, balance, payouts, expressLoginUrl }
 *
 *   POST { action: "login_link", accountId }
 *     ← { url }
 *
 * Requires:  firebase functions:config:set stripe.secret="sk_live_..."
 */
export const stripeConnect = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
        return;
      }

      const stripeSecret =
        functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret) {
        res.status(500).json({
          success: false,
          error:
            'Stripe is not configured on the server. Set it with: firebase functions:config:set stripe.secret="sk_live_..."',
        });
        return;
      }

      const stripe = new Stripe(stripeSecret, {
        apiVersion: '2023-10-16',
        typescript: true,
      });

      const body = (req.body || {}) as Record<string, any>;
      const action = body.action as string | undefined;

      // ── ONBOARD ────────────────────────────────────────────────────────
      if (action === 'onboard') {
        const {
          proId,
          email,
          name,
          country,
          refreshUrl,
          returnUrl,
          existingAccountId,
        } = body as {
          proId?: string;
          email?: string;
          name?: string;
          country?: string;
          refreshUrl?: string;
          returnUrl?: string;
          existingAccountId?: string;
        };

        if (!proId) {
          res.status(400).json({ success: false, error: 'Missing proId.' });
          return;
        }
        if (!refreshUrl || !returnUrl) {
          res.status(400).json({
            success: false,
            error: 'Missing refreshUrl / returnUrl.',
          });
          return;
        }

        let accountId = existingAccountId;

        // Verify any provided account still exists; if Stripe lost it (test
        // mode wipes, deleted accounts, etc.) we fall through to create a new one.
        if (accountId) {
          try {
            await stripe.accounts.retrieve(accountId);
          } catch (e: any) {
            console.warn(
              `[stripeConnect] existingAccountId ${accountId} not found, creating fresh`,
              e?.message
            );
            accountId = undefined;
          }
        }

        if (!accountId) {
          const acct = await stripe.accounts.create({
            type: 'express',
            country: country || 'US',
            ...(email ? { email } : {}),
            capabilities: {
              card_payments: { requested: true },
              transfers: { requested: true },
            },
            business_type: 'individual',
            business_profile: {
              product_description:
                'Tax preparation and consulting services on Refund Connect',
            },
            metadata: {
              proId,
              ...(name ? { proName: name } : {}),
            },
          });
          accountId = acct.id;

          // Persist immediately so resume reuses the same account.
          try {
            await db
              .collection('professionals')
              .doc(proId)
              .set(
                {
                  stripe_account_id: accountId,
                  stripe_onboarding_started_at:
                    admin.firestore.FieldValue.serverTimestamp(),
                  updated_at: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
          } catch (e) {
            console.warn(
              '[stripeConnect] failed to persist stripe_account_id',
              e
            );
          }
        }

        const link = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_onboarding',
        });

        res.status(200).json({
          success: true,
          accountId,
          onboardingUrl: link.url,
          expiresAt: link.expires_at,
        });
        return;
      }

      // ── STATUS ─────────────────────────────────────────────────────────
      if (action === 'status') {
        const { accountId, proId } = body as { accountId?: string; proId?: string };
        if (!accountId) {
          res.status(400).json({ success: false, error: 'Missing accountId.' });
          return;
        }
        const acct = await stripe.accounts.retrieve(accountId);
        const summary = summarizeStripeAccount(acct);

        // Mirror capability flags to Firestore if a proId was provided.
        if (proId) {
          try {
            const fullyEnabled =
              summary.chargesEnabled && summary.payoutsEnabled;
            await db
              .collection('professionals')
              .doc(proId)
              .set(
                {
                  stripe_account_id: summary.accountId,
                  stripe_charges_enabled: summary.chargesEnabled,
                  stripe_payouts_enabled: summary.payoutsEnabled,
                  stripe_details_submitted: summary.detailsSubmitted,
                  stripe_onboarding_completed_at: fullyEnabled
                    ? admin.firestore.FieldValue.serverTimestamp()
                    : null,
                  updated_at: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
          } catch (e) {
            console.warn(
              '[stripeConnect] failed to sync capability flags to Firestore',
              e
            );
          }
        }

        res.status(200).json({ success: true, ...summary });
        return;
      }

      // ── DASHBOARD ──────────────────────────────────────────────────────
      if (action === 'dashboard') {
        const { accountId } = body as { accountId?: string };
        if (!accountId) {
          res.status(400).json({ success: false, error: 'Missing accountId.' });
          return;
        }

        // Run the three Stripe calls in parallel for snappiness.
        const [acct, balance, payoutsResp] = await Promise.all([
          stripe.accounts.retrieve(accountId),
          stripe.balance.retrieve({ stripeAccount: accountId }),
          stripe.payouts
            .list({ limit: 10 }, { stripeAccount: accountId })
            .catch((e) => {
              console.warn('[stripeConnect] payouts.list failed', e?.message);
              return { data: [] } as any;
            }),
        ]);

        // Express login link is only valid after onboarding completes.
        let expressLoginUrl: string | null = null;
        try {
          const login = await stripe.accounts.createLoginLink(accountId);
          expressLoginUrl = login?.url || null;
        } catch (_e) {
          // not yet eligible
        }

        const sumBalances = (arr: any[]): number =>
          Array.isArray(arr)
            ? arr.reduce(
                (acc: number, b: any) => acc + Number(b.amount || 0),
                0
              )
            : 0;

        res.status(200).json({
          success: true,
          account: summarizeStripeAccount(acct),
          balance: {
            currency: (balance as any)?.available?.[0]?.currency || 'usd',
            availableCents: sumBalances((balance as any)?.available),
            pendingCents: sumBalances((balance as any)?.pending),
            reservedCents: sumBalances(
              (balance as any)?.connect_reserved || []
            ),
            available: (balance as any)?.available || [],
            pending: (balance as any)?.pending || [],
          },
          payouts: Array.isArray(payoutsResp?.data)
            ? payoutsResp.data.map((p: any) => ({
                id: p.id,
                amount: p.amount,
                currency: p.currency,
                arrivalDate: p.arrival_date,
                status: p.status,
                method: p.method,
                type: p.type,
                created: p.created,
                description: p.description || null,
                statementDescriptor: p.statement_descriptor || null,
                failureMessage: p.failure_message || null,
              }))
            : [],
          expressLoginUrl,
        });
        return;
      }

      // ── LOGIN LINK ─────────────────────────────────────────────────────
      if (action === 'login_link') {
        const { accountId } = body as { accountId?: string };
        if (!accountId) {
          res.status(400).json({ success: false, error: 'Missing accountId.' });
          return;
        }
        const link = await stripe.accounts.createLoginLink(accountId);
        res.status(200).json({ success: true, url: link.url });
        return;
      }

      res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    } catch (err: any) {
      console.error('[stripeConnect] Error:', err);
      if (err?.type && typeof err.type === 'string' && err.type.startsWith('Stripe')) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: err.message || 'Stripe error',
          code: err.code,
          type: err.type,
        });
        return;
      }
      res
        .status(500)
        .json({ success: false, error: err?.message || 'Internal server error.' });
    }
  });
});

/** Reduce a Stripe.Account into the small JSON shape the frontend consumes. */
function summarizeStripeAccount(acct: Stripe.Account) {
  return {
    accountId: acct.id,
    chargesEnabled: !!acct.charges_enabled,
    payoutsEnabled: !!acct.payouts_enabled,
    detailsSubmitted: !!acct.details_submitted,
    country: acct.country || null,
    defaultCurrency: acct.default_currency || 'usd',
    email: acct.email || null,
    businessProfile: acct.business_profile || null,
    requirements: {
      currentlyDue: acct.requirements?.currently_due || [],
      pastDue: acct.requirements?.past_due || [],
      eventuallyDue: acct.requirements?.eventually_due || [],
      disabledReason: acct.requirements?.disabled_reason || null,
    },
    payoutSchedule: acct.settings?.payouts?.schedule || null,
  };
}



/**
 * stripeHealth
 *
 * Diagnostic endpoint for the /admin/stripe-health page. Returns the
 * current state of the entire payment pipeline so the platform owner
 * can spot a broken setup within seconds instead of weeks. Designed to
 * NEVER throw — every check is wrapped and reports its own pass/fail.
 *
 * Request (GET or POST, no body required).
 *
 * Response (200 JSON):
 *   {
 *     success: true,
 *     server: {
 *       stripeSecretConfigured: boolean,
 *       stripeSecretMode: 'live' | 'test' | 'unknown' | null,
 *       webhookSecretConfigured: boolean,
 *       platformAccount: {
 *         ok: boolean,
 *         accountId: string|null,
 *         chargesEnabled: boolean,
 *         payoutsEnabled: boolean,
 *         detailsSubmitted: boolean,
 *         country: string|null,
 *         defaultCurrency: string|null,
 *         email: string|null,
 *         disabledReason: string|null,
 *         currentlyDue: string[],
 *         pastDue: string[],
 *         error?: string,
 *       },
 *       recentEvents: Array<{ eventId, type, createdAt, receivedAt, handled, livemode, objectId, amount, handlerError? }>,
 *       lastEventAt: number|null,        // unix ms of most recent event
 *       totalEventsLogged: number,
 *     }
 *   }
 */
export const stripeHealth = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed.' });
        return;
      }

      const stripeSecret =
        functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY;
      const webhookSecret =
        functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

      const stripeSecretMode: 'live' | 'test' | 'unknown' | null = stripeSecret
        ? stripeSecret.startsWith('sk_live_')
          ? 'live'
          : stripeSecret.startsWith('sk_test_')
            ? 'test'
            : 'unknown'
        : null;

      // ── Platform account check ─────────────────────────────────────────
      let platformAccount: any = {
        ok: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        country: null,
        defaultCurrency: null,
        email: null,
        disabledReason: null,
        currentlyDue: [],
        pastDue: [],
      };
      if (stripeSecret) {
        try {
          const stripe = new Stripe(stripeSecret, {
            apiVersion: '2023-10-16',
            typescript: true,
          });
          const acct = await stripe.accounts.retrieve();
          const summary = summarizeStripeAccount(acct);
          platformAccount = {
            ok: summary.chargesEnabled,
            accountId: summary.accountId,
            chargesEnabled: summary.chargesEnabled,
            payoutsEnabled: summary.payoutsEnabled,
            detailsSubmitted: summary.detailsSubmitted,
            country: summary.country,
            defaultCurrency: summary.defaultCurrency,
            email: summary.email,
            disabledReason: summary.requirements?.disabledReason || null,
            currentlyDue: summary.requirements?.currentlyDue || [],
            pastDue: summary.requirements?.pastDue || [],
          };
        } catch (err: any) {
          platformAccount = {
            ...platformAccount,
            ok: false,
            error: err?.message || 'Failed to retrieve platform account from Stripe.',
          };
        }
      } else {
        platformAccount.error =
          'Stripe secret key is not configured. Run: firebase functions:config:set stripe.secret="sk_live_..."';
      }

      // ── Recent webhook events ──────────────────────────────────────────
      let recentEvents: any[] = [];
      let lastEventAt: number | null = null;
      let totalEventsLogged = 0;
      try {
        const snap = await db
          .collection('stripe_webhook_events')
          .orderBy('receivedAt', 'desc')
          .limit(10)
          .get();
        recentEvents = snap.docs.map((d) => {
          const v = d.data() || {};
          const receivedAt =
            (v.receivedAt && typeof v.receivedAt.toMillis === 'function'
              ? v.receivedAt.toMillis()
              : null) || null;
          const createdAt =
            (v.createdAt && typeof v.createdAt.toMillis === 'function'
              ? v.createdAt.toMillis()
              : null) || null;
          if (receivedAt && (!lastEventAt || receivedAt > lastEventAt)) {
            lastEventAt = receivedAt;
          }
          return {
            eventId: v.eventId || d.id,
            type: v.type || null,
            createdAt,
            receivedAt,
            handled: v.handled === true,
            livemode: !!v.livemode,
            objectId: v.objectId || null,
            objectType: v.objectType || null,
            amount: typeof v.amount === 'number' ? v.amount : null,
            currency: v.currency || null,
            handlerError: v.handlerError || null,
          };
        });

        // Also get a count (capped at 1000 to keep it cheap).
        const countSnap = await db
          .collection('stripe_webhook_events')
          .limit(1000)
          .get();
        totalEventsLogged = countSnap.size;
      } catch (e: any) {
        console.warn('[stripeHealth] failed to read recent events:', e?.message);
      }

      res.status(200).json({
        success: true,
        server: {
          stripeSecretConfigured: !!stripeSecret,
          stripeSecretMode,
          webhookSecretConfigured: !!webhookSecret,
          platformAccount,
          recentEvents,
          lastEventAt,
          totalEventsLogged,
          checkedAt: Date.now(),
        },
      });
    } catch (err: any) {
      console.error('[stripeHealth] Unexpected error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Internal server error running health checks.',
      });
    }
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: onboardingReminderCron
//
// 100% Firebase. No Supabase, no edge functions. This is a native Firebase
// Scheduled (Cloud Scheduler + Pub/Sub) Cloud Function that runs every few
// hours and nudges tax pros who started — but never finished — onboarding.
//
// What it does on each tick:
//   1. Scans `professionals` for docs that are NOT finished:
//        - onboarding_completed !== true
//        - application_status !== 'submitted'
//   2. Keeps only drafts whose onboarding_draft.savedAt is OLDER than 48 hours
//      (and not older than 30 days, so we never spam long-abandoned records).
//   3. Skips anyone we've already reminded (dedup ledger: onboarding_reminders/{uid}).
//   4. Emails a branded "Finish your Refund Connect application" reminder with a
//      Resume link back to the onboarding page — sent via nodemailer (Gmail,
//      already configured for sendEmail) AND mirrored into the `mail` collection
//      so the Firebase Trigger Email extension also delivers it if installed.
//   5. Records onboarding_reminders/{uid} so the same pro is never reminded twice.
//
// Config (optional override of the resume link base):
//   firebase functions:config:set app.onboarding_url="https://www.refund-connect.com/onboarding"
// Requires the same Gmail creds already used by sendEmail:
//   firebase functions:config:set gmail.user="..." gmail.password="..."
// ─────────────────────────────────────────────────────────────────────────────

const REMINDER_BRAND = 'Refund Connect';
const REMINDER_SUPPORT_EMAIL = 'support@refund-connect.com';
const REMINDER_STALE_MS = 48 * 60 * 60 * 1000; // 48 hours
const REMINDER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Parse a savedAt value that may be an ISO string, epoch ms number, or Firestore Timestamp. */
function parseSavedAtMs(raw: any): number | null {
  if (raw == null) return null;
  // Firestore Timestamp (admin SDK)
  if (typeof raw === 'object' && typeof raw.toMillis === 'function') {
    try {
      return raw.toMillis();
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && typeof raw._seconds === 'number') {
    return raw._seconds * 1000;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Heuristic: seconds vs ms
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function buildReminderEmail(opts: {
  name: string;
  resumeUrl: string;
  stepLabel: string;
}): { subject: string; html: string; text: string } {
  const accent = PLATFORM_PRIMARY;
  const subject = `Finish your ${REMINDER_BRAND} application — you're almost there`;
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,${accent} 0%,#1e40af 100%);color:#ffffff;padding:34px 30px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.16);padding:6px 14px;border-radius:999px;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">Application started</div>
        <h1 style="margin:0;font-size:26px;font-weight:700;line-height:1.25;">You're almost done!</h1>
        <p style="margin:10px 0 0;font-size:15px;opacity:0.95;">Just a few steps left to join ${REMINDER_BRAND}.</p>
      </div>
      <div style="padding:30px;">
        <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${escapeHtmlServer(opts.name || 'there')},</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
          We noticed you started your ${REMINDER_BRAND} tax professional application but haven't finished it yet.
          Your progress is saved, so you can pick up <strong>exactly where you left off</strong> — no need to start over.
        </p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;margin:0 0 24px;">
          <p style="margin:0;font-size:14px;color:#1e3a8a;"><strong>Where you left off:</strong> ${escapeHtmlServer(opts.stepLabel)}</p>
        </div>
        <div style="text-align:center;margin:0 0 26px;">
          <a href="${opts.resumeUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Finish my application</a>
        </div>
        <p style="margin:0 0 6px;font-size:13px;color:#6b7280;line-height:1.6;">
          Completing your application gets your profile live in our directory so clients can find and book you. It only takes a few minutes.
        </p>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
          Questions? Just reply to this email or reach us at
          <a href="mailto:${REMINDER_SUPPORT_EMAIL}" style="color:${accent};">${REMINDER_SUPPORT_EMAIL}</a>.
        </p>
      </div>
      <div style="background:#111827;color:#9ca3af;padding:16px 30px;text-align:center;font-size:12px;">
        © ${new Date().getFullYear()} ${REMINDER_BRAND}. You're receiving this because you began a professional application with us.
      </div>
    </div>
  </div>
</body></html>`;
  const text =
    `Hi ${opts.name || 'there'},\n\n` +
    `You started your ${REMINDER_BRAND} tax professional application but haven't finished it yet. ` +
    `Your progress is saved — pick up where you left off (${opts.stepLabel}).\n\n` +
    `Finish your application: ${opts.resumeUrl}\n\n` +
    `Questions? Email ${REMINDER_SUPPORT_EMAIL}.\n`;
  return { subject, html, text };
}

function escapeHtmlServer(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const STEP_LABELS: Record<number, string> = {
  2: 'Profile setup',
  3: 'Selecting your services',
  4: 'Reviewing your profile',
  5: 'Application intake questions',
  6: 'Signing the agreement',
};

export const onboardingReminderCron = functions.pubsub
  .schedule('every 6 hours')
  .timeZone('UTC')
  .onRun(async () => {
    const now = Date.now();
    const onboardingBaseUrl =
      functions.config().app?.onboarding_url ||
      process.env.ONBOARDING_URL ||
      'https://www.refund-connect.com/onboarding';

    const gmailUser = functions.config().gmail?.user || process.env.GMAIL_USER;
    const gmailPassword =
      functions.config().gmail?.password || process.env.GMAIL_APP_PASSWORD;

    let transporter: nodemailer.Transporter | null = null;
    if (gmailUser && gmailPassword) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPassword },
      });
    } else {
      console.warn(
        '[onboardingReminderCron] Gmail creds not configured; will only queue into `mail` collection.'
      );
    }

    let scanned = 0;
    let eligible = 0;
    let sent = 0;
    let skippedAlreadyReminded = 0;

    try {
      const snap = await db.collection('professionals').get();
      scanned = snap.size;

      for (const docSnap of snap.docs) {
        const data = docSnap.data() || {};
        const uid = docSnap.id;

        // Skip finished applications.
        if (data.onboarding_completed === true) continue;
        if (data.application_status === 'submitted') continue;

        const draft = data.onboarding_draft || {};
        const savedAtMs = parseSavedAtMs(draft.savedAt);
        if (savedAtMs == null) continue;

        const age = now - savedAtMs;
        // Must be stale (>48h) but not ancient (<30d).
        if (age < REMINDER_STALE_MS) continue;
        if (age > REMINDER_MAX_AGE_MS) continue;

        eligible++;

        // Dedup: have we already reminded this pro?
        const reminderRef = db.collection('onboarding_reminders').doc(uid);
        const reminderSnap = await reminderRef.get();
        if (reminderSnap.exists) {
          skippedAlreadyReminded++;
          continue;
        }

        // Resolve recipient email + name.
        const email =
          (typeof data.email === 'string' && data.email) ||
          (typeof draft?.profile?.email === 'string' && draft.profile.email) ||
          '';
        if (!email || !/.+@.+\..+/.test(email)) {
          // No usable email — record a skip so we don't re-scan it forever.
          await reminderRef.set({
            uid,
            status: 'skipped_no_email',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }

        const firstName =
          data.first_name ||
          draft?.profile?.firstName ||
          (typeof data.full_name === 'string' ? data.full_name.split(' ')[0] : '') ||
          '';

        const step =
          typeof data.onboarding_step === 'number'
            ? data.onboarding_step
            : typeof draft?.step === 'number'
              ? draft.step
              : 2;
        const stepLabel = STEP_LABELS[step] || 'Continuing your application';

        const resumeUrl = onboardingBaseUrl;
        const { subject, html, text } = buildReminderEmail({
          name: firstName,
          resumeUrl,
          stepLabel,
        });

        let delivered = false;
        // Path A: direct send via Gmail (proven path used by sendEmail).
        if (transporter) {
          try {
            await transporter.sendMail({
              from: `${REMINDER_BRAND} <${gmailUser}>`,
              to: email,
              subject,
              html,
              text,
            });
            delivered = true;
          } catch (e: any) {
            console.warn(
              `[onboardingReminderCron] nodemailer send failed for ${email}:`,
              e?.message
            );
          }
        }

        // Path B: also enqueue into `mail` (Firebase Trigger Email extension).
        try {
          await db.collection('mail').add({
            to: email,
            message: { subject, html, text },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e: any) {
          console.warn(
            `[onboardingReminderCron] mail collection enqueue failed for ${email}:`,
            e?.message
          );
        }

        // Record the dedup ledger entry so we never remind this pro again.
        await reminderRef.set({
          uid,
          email,
          stepReminded: step,
          draftSavedAt: new Date(savedAtMs).toISOString(),
          deliveredViaGmail: delivered,
          status: 'sent',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        sent++;
      }

      console.log(
        `[onboardingReminderCron] done. scanned=${scanned} eligible=${eligible} sent=${sent} alreadyReminded=${skippedAlreadyReminded}`
      );
    } catch (err: any) {
      console.error('[onboardingReminderCron] fatal error:', err?.message || err);
    }

    return null;
  });
