import { getApps } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { reload, User } from 'firebase/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Email verification — Firebase verification LINK, delivered via the app's
// email pipeline (Resend, Gmail fallback) through the deployed
// `requestEmailVerification` Cloud Function.
//
// We do NOT use the client SDK's sendEmailVerification(): on this project it is
// rate-limited (auth/too-many-requests) and delivered through Google's own SMTP,
// which frequently never arrives. The Cloud Function generates the verification
// link with the Admin SDK and sends it over a transport we control.
//
// The link still targets Firebase's hosted action handler, so clicking it flips
// the account's `emailVerified` flag — genuine Firebase email verification.
//
// REQUIRES (operator): a real email credential in functions/.env —
//   RESEND_API_KEY=re_...  (+ verified RESEND_FROM domain)   — recommended, OR
//   GMAIL_USER=... + GMAIL_APP_PASSWORD=...                   — quick alternative
// then `firebase deploy --only functions:requestEmailVerification`.
// ─────────────────────────────────────────────────────────────────────────────

/** Build the callable lazily. Region must match the deployed function. */
const getRequestVerificationCallable = () => {
  if (!getApps().length) {
    throw new Error('Firebase app not initialized — cannot send verification email.');
  }
  const functionsInstance = getFunctions(getApps()[0], 'us-central1');
  return httpsCallable<{ continueUrl?: string }, { success: boolean; alreadyVerified?: boolean }>(
    functionsInstance,
    'requestEmailVerification'
  );
};

/** Map an error from the callable / Firebase to a message safe to show users. */
export const verificationErrorMessage = (error: any): string => {
  switch (error?.code) {
    case 'functions/unauthenticated':
      return 'Please sign in again, then retry.';
    case 'functions/failed-precondition':
      // The function throws this when no email provider is configured yet.
      return error?.message || 'Email sending is not configured yet. Please contact support.';
    case 'functions/not-found':
    case 'functions/unavailable':
    case 'functions/internal':
      return error?.message || 'Verification email service is unavailable right now. Please try again shortly.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes before requesting another email.';
    case 'auth/invalid-email':
      return 'This email address is invalid.';
    default:
      return error?.message || 'Could not send the verification email. Please try again.';
  }
};

/** Send the verification email (Firebase link, delivered via the Cloud Function). */
export const sendVerificationEmail = async (_user?: User): Promise<void> => {
  const callable = getRequestVerificationCallable();
  await callable({ continueUrl: `${window.location.origin}/member-portal` });
};

/** Reload the user from Firebase and return the latest emailVerified state. */
export const checkEmailVerified = async (user: User): Promise<boolean> => {
  await reload(user);
  return user.emailVerified;
};

/**
 * Resend the verification email. Reloads first so an already-verified user
 * isn't emailed needlessly.
 */
export const resendVerificationEmail = async (user: User): Promise<void> => {
  await reload(user);
  if (user.emailVerified) {
    throw new Error('Your email is already verified.');
  }
  await sendVerificationEmail(user);
};
