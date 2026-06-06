import {
  queueFirebaseEmail,
  buildBrandedEmail,
  ADMIN_NOTIFICATION_EMAIL,
} from '@/services/firebaseEmailService';

interface StatusChangeNotification {
  email: string;
  name: string;
  status: 'approved' | 'rejected';
  reviewNotes?: string;
}

/**
 * Send the applicant a status-change email (approved / rejected) AND
 * BCC the admin (info@alliance-tax.com) so a record is kept centrally.
 *
 * Routed through Firebase (Firestore `mail` collection) — no Supabase.
 * Never throws — email failures should not block the admin's review action.
 */
export const sendApplicationStatusEmail = async ({
  email,
  name,
  status,
  reviewNotes,
}: StatusChangeNotification): Promise<void> => {
  try {
    const isApproved = status === 'approved';

    const subject = isApproved
      ? 'Your Tax Professional Application Has Been Approved!'
      : 'Update on Your Tax Professional Application';

    const intro = isApproved
      ? `Congratulations ${name}! Your application to join Refund Connect as a tax professional has been approved. You can now log in and start connecting with clients.`
      : `Hi ${name}, thank you for your interest in joining Refund Connect. After careful review, we're unable to approve your application at this time.`;

    const rows: Array<{ label: string; value: string }> = [
      { label: 'Status', value: isApproved ? 'Approved' : 'Not approved' },
    ];
    if (reviewNotes) {
      rows.push({
        label: isApproved ? 'Admin Notes' : 'Reason',
        value: reviewNotes,
      });
    }

    const portalUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/member-portal`
        : 'https://alliance-tax.com/member-portal';

    const html = buildBrandedEmail({
      title: subject,
      intro,
      rows,
      ctaLabel: isApproved ? 'Sign In to Your Account' : undefined,
      ctaUrl: isApproved ? portalUrl : undefined,
      footer:
        'Questions? Reply to this email or contact info@alliance-tax.com.',
      accentColor: isApproved ? '#10b981' : '#6b7280',
    });

    // Email the applicant.
    await queueFirebaseEmail({
      to: email,
      subject,
      html,
      category: isApproved ? 'application_approved' : 'application_rejected',
      meta: { applicantName: name, reviewNotes: reviewNotes || '' },
    });

    // Send a copy to admin so it appears in the admin notifications feed.
    await queueFirebaseEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `[Admin Copy] ${subject} — ${name}`,
      html,
      category: 'admin_application_decision',
      meta: {
        applicantName: name,
        applicantEmail: email,
        decision: status,
        reviewNotes: reviewNotes || '',
      },
    });
  } catch (error) {
    console.error('Error sending application status email:', error);
    // Non-blocking: do not rethrow.
  }
};
