import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Firebase-based email/notification service.
 *
 * Strategy:
 * 1) Write a document to the `mail` Firestore collection.
 *    This is the standard format consumed by the Firebase "Trigger Email"
 *    extension (https://extensions.dev/extensions/firebase/firestore-send-email).
 *    Once that extension is installed and pointed at the `mail` collection,
 *    emails are sent automatically — no Supabase / no edge function required.
 *
 * 2) Also write a record to an `admin_notifications` collection so the admin
 *    dashboard can render in-app notifications even if email delivery
 *    is not yet configured.
 *
 * All writes are safe / idempotent and never throw — email failures should
 * never block a user's form submission.
 */

export const ADMIN_NOTIFICATION_EMAIL = 'info@alliance-tax.com';

export interface SimpleEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Category for the in-app notification feed (e.g. 'professional_application') */
  category?: string;
  /** Optional structured data attached to the in-app notification feed entry */
  meta?: Record<string, any>;
}

/**
 * Queue an email for delivery via Firebase (Trigger Email extension)
 * and record an admin notification entry. Never throws.
 */
export async function queueFirebaseEmail(payload: SimpleEmailPayload): Promise<void> {
  const { to, subject, html, text, category, meta } = payload;

  // 1) Queue the email itself.
  try {
    await addDoc(collection(db, 'mail'), {
      to,
      message: {
        subject,
        html,
        ...(text ? { text } : {}),
      },
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('⚠️ Failed to queue email in Firestore `mail` collection:', err);
  }

  // 2) Always record an in-app notification entry for the admin dashboard.
  try {
    await addDoc(collection(db, 'admin_notifications'), {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      category: category || 'general',
      meta: meta || {},
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('⚠️ Failed to record admin notification entry:', err);
  }
}

/**
 * Build a clean, branded HTML email body.
 */
export function buildBrandedEmail(opts: {
  title: string;
  intro?: string;
  rows?: Array<{ label: string; value: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
  accentColor?: string;
}): string {
  const accent = opts.accentColor || '#2563eb';
  const rowsHtml = (opts.rows || [])
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;width:40%;">${escapeHtml(
            r.label,
          )}</td>
          <td style="padding:8px 12px;color:#111827;background:#ffffff;border-bottom:1px solid #e5e7eb;">${escapeHtml(
            r.value,
          )}</td>
        </tr>`,
    )
    .join('');

  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<div style="text-align:center;margin:28px 0 8px;">
           <a href="${opts.ctaUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">${escapeHtml(
             opts.ctaLabel,
           )}</a>
         </div>`
      : '';

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${accent};color:#ffffff;padding:24px 28px;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(opts.title)}</h1>
    </div>
    <div style="padding:24px 28px;">
      ${opts.intro ? `<p style="margin:0 0 16px;line-height:1.5;color:#374151;">${escapeHtml(opts.intro)}</p>` : ''}
      ${
        rowsHtml
          ? `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px;">${rowsHtml}</table>`
          : ''
      }
      ${cta}
      ${
        opts.footer
          ? `<p style="margin:24px 0 0;font-size:12px;color:#6b7280;text-align:center;">${escapeHtml(opts.footer)}</p>`
          : ''
      }
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
