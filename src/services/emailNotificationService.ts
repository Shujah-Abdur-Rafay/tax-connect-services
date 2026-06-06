import {
  queueFirebaseEmail,
  buildBrandedEmail,
  ADMIN_NOTIFICATION_EMAIL,
} from '@/services/firebaseEmailService';

/**
 * App-wide email notification service.
 *
 * All notifications are now routed through Firebase:
 * - Emails are queued to the Firestore `mail` collection (Firebase Trigger
 *   Email extension pattern)
 * - An in-app notification record is also written so the admin dashboard
 *   can render it
 *
 * The admin / "house" address for system notifications is info@alliance-tax.com
 * (configured in firebaseEmailService.ADMIN_NOTIFICATION_EMAIL).
 */

interface EmailNotificationData {
  type:
    | 'document_upload'
    | 'document_review'
    | 'appointment_booked'
    | 'appointment_cancelled'
    | 'payment_processed';
  recipientEmail: string;
  recipientName: string;
  data: any;
}

function preferenceKey(type: string): string | null {
  const mapping: Record<string, string> = {
    document_upload: 'documentUpload',
    document_review: 'documentReview',
    appointment_booked: 'appointmentBooked',
    appointment_cancelled: 'appointmentCancelled',
    payment_processed: 'paymentProcessed',
  };
  return mapping[type] || null;
}

function isAllowedByPreferences(type: string): boolean {
  try {
    const prefs = localStorage.getItem('notificationPreferences');
    if (!prefs) return true;
    const settings = JSON.parse(prefs);
    const key = preferenceKey(type);
    if (!key) return true;
    return settings[key] !== false;
  } catch {
    return true;
  }
}

function renderTemplate(notification: EmailNotificationData): {
  subject: string;
  html: string;
} {
  const { type, recipientName, data } = notification;

  switch (type) {
    case 'document_upload':
      return {
        subject: `New document uploaded: ${data.documentName}`,
        html: buildBrandedEmail({
          title: 'New Document Uploaded',
          intro: `Hi ${recipientName}, ${data.clientName} just uploaded a new document for your review.`,
          rows: [
            { label: 'Client', value: data.clientName },
            { label: 'Document', value: data.documentName },
            { label: 'Category', value: data.category },
            { label: 'Uploaded', value: data.uploadDate },
          ],
          ctaLabel: 'Review Document',
          ctaUrl: data.portalUrl,
          accentColor: '#2563eb',
        }),
      };

    case 'document_review':
      return {
        subject: `Your document was reviewed: ${data.documentName}`,
        html: buildBrandedEmail({
          title: 'Document Reviewed',
          intro: `Hi ${data.clientName}, your tax professional ${data.professionalName} has reviewed your document.`,
          rows: [
            { label: 'Document', value: data.documentName },
            { label: 'Status', value: data.status },
            ...(data.notes ? [{ label: 'Notes', value: data.notes }] : []),
          ],
          ctaLabel: 'Open Member Portal',
          ctaUrl: data.portalUrl,
          accentColor: '#10b981',
        }),
      };

    case 'appointment_booked':
      return {
        subject: `Appointment confirmed with ${data.professionalName}`,
        html: buildBrandedEmail({
          title: 'Appointment Confirmed',
          intro: `Hi ${data.clientName}, your appointment with ${data.professionalName} is confirmed.`,
          rows: [
            { label: 'Professional', value: data.professionalName },
            { label: 'Service', value: data.service },
            { label: 'Date', value: data.date },
            { label: 'Time', value: data.time },
            { label: 'Duration', value: data.duration },
          ],
          ctaLabel: 'View Appointment',
          ctaUrl: data.portalUrl,
          accentColor: '#10b981',
        }),
      };

    case 'appointment_cancelled':
      return {
        subject: `Appointment cancelled with ${data.professionalName}`,
        html: buildBrandedEmail({
          title: 'Appointment Cancelled',
          intro: `Hi ${data.clientName}, your appointment with ${data.professionalName} on ${data.date} at ${data.time} has been cancelled.`,
          rows: [
            { label: 'Professional', value: data.professionalName },
            { label: 'Date', value: data.date },
            { label: 'Time', value: data.time },
            ...(data.reason ? [{ label: 'Reason', value: data.reason }] : []),
          ],
          ctaLabel: 'Find a Professional',
          ctaUrl: data.portalUrl,
          accentColor: '#ef4444',
        }),
      };

    case 'payment_processed':
      return {
        subject: `Payment receipt: $${data.amount}`,
        html: buildBrandedEmail({
          title: 'Payment Receipt',
          intro: `Hi ${data.clientName}, we received your payment. Thank you!`,
          rows: [
            { label: 'Amount', value: `$${data.amount}` },
            { label: 'Service', value: data.service },
            { label: 'Date', value: data.date },
            { label: 'Transaction ID', value: data.transactionId },
          ],
          ctaLabel: 'View Invoice',
          ctaUrl: data.invoiceUrl,
          accentColor: '#2563eb',
        }),
      };

    default:
      return {
        subject: 'Notification from Refund Connect',
        html: buildBrandedEmail({
          title: 'Notification',
          intro: `Hi ${recipientName}, you have a new notification.`,
        }),
      };
  }
}

export const emailNotificationService = {
  async sendNotification(notification: EmailNotificationData) {
    try {
      if (!isAllowedByPreferences(notification.type)) {
        console.log(
          'Notification disabled by user preferences:',
          notification.type,
        );
        return { success: true, skipped: true };
      }

      const { subject, html } = renderTemplate(notification);

      await queueFirebaseEmail({
        to: notification.recipientEmail,
        subject,
        html,
        category: notification.type,
        meta: {
          recipientName: notification.recipientName,
          ...notification.data,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send email notification:', error);
      // Non-blocking — surface but don't crash callers
      return { success: false, error };
    }
  },

  /**
   * Notify the admin (info@alliance-tax.com) of an arbitrary system event.
   * Useful anywhere in the app that needs to flag something to admin.
   */
  async notifyAdmin(opts: {
    subject: string;
    intro?: string;
    rows?: Array<{ label: string; value: string }>;
    ctaLabel?: string;
    ctaUrl?: string;
    category?: string;
    meta?: Record<string, any>;
  }) {
    const html = buildBrandedEmail({
      title: opts.subject,
      intro: opts.intro,
      rows: opts.rows,
      ctaLabel: opts.ctaLabel,
      ctaUrl: opts.ctaUrl,
      accentColor: '#2563eb',
    });
    await queueFirebaseEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: opts.subject,
      html,
      category: opts.category || 'admin',
      meta: opts.meta || {},
    });
  },

  async notifyDocumentUpload(
    clientName: string,
    documentName: string,
    category: string,
    professionalEmail: string,
    professionalName: string,
  ) {
    return this.sendNotification({
      type: 'document_upload',
      recipientEmail: professionalEmail,
      recipientName: professionalName,
      data: {
        clientName,
        documentName,
        category,
        uploadDate: new Date().toLocaleDateString(),
        professionalName,
        portalUrl: `${window.location.origin}/member-portal`,
      },
    });
  },

  async notifyDocumentReview(
    clientEmail: string,
    clientName: string,
    documentName: string,
    status: string,
    professionalName: string,
    notes?: string,
  ) {
    return this.sendNotification({
      type: 'document_review',
      recipientEmail: clientEmail,
      recipientName: clientName,
      data: {
        clientName,
        documentName,
        status,
        professionalName,
        notes,
        portalUrl: `${window.location.origin}/member-portal`,
      },
    });
  },

  async notifyAppointmentBooked(
    clientEmail: string,
    clientName: string,
    professionalName: string,
    date: string,
    time: string,
    service: string,
    duration: string,
  ) {
    return this.sendNotification({
      type: 'appointment_booked',
      recipientEmail: clientEmail,
      recipientName: clientName,
      data: {
        clientName,
        professionalName,
        date,
        time,
        service,
        duration,
        portalUrl: `${window.location.origin}/member-portal`,
      },
    });
  },

  async notifyAppointmentCancelled(
    clientEmail: string,
    clientName: string,
    professionalName: string,
    date: string,
    time: string,
    reason?: string,
  ) {
    return this.sendNotification({
      type: 'appointment_cancelled',
      recipientEmail: clientEmail,
      recipientName: clientName,
      data: {
        clientName,
        professionalName,
        date,
        time,
        reason,
        portalUrl: `${window.location.origin}/find-professionals`,
      },
    });
  },

  async notifyPaymentProcessed(
    clientEmail: string,
    clientName: string,
    amount: string,
    service: string,
    transactionId: string,
  ) {
    return this.sendNotification({
      type: 'payment_processed',
      recipientEmail: clientEmail,
      recipientName: clientName,
      data: {
        clientName,
        amount,
        service,
        date: new Date().toLocaleDateString(),
        transactionId,
        invoiceUrl: `${window.location.origin}/member-portal`,
      },
    });
  },
};

// Convenience named exports
export const notifyAdmin = emailNotificationService.notifyAdmin.bind(
  emailNotificationService,
);
