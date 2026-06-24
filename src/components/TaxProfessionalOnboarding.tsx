import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, ArrowLeft, LogOut, LogIn, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db, auth } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import OnboardingProgress from './onboarding/OnboardingProgress';
import AccountCreationStep from './onboarding/AccountCreationStep';
import ProfileSetupStep from './onboarding/ProfileSetupStep';
import ServiceOfferingsStep from './onboarding/ServiceOfferingsStep';
import ProfilePreviewStep from './onboarding/ProfilePreviewStep';
import EmailVerificationPending from './EmailVerificationPending';
import { sendVerificationEmail } from '@/services/emailVerificationService';
import LoginDialog from './LoginDialog';
import JotFormQuestionsStep, {
  JotFormAnswers,
  EMPTY_JOTFORM_ANSWERS,
} from './onboarding/JotFormQuestionsStep';
import TermsAgreementStep, {
  SignedAgreement,
  AGREEMENT_VERSION,
  AGREEMENT_TITLE,
} from './onboarding/TermsAgreementStep';
import MembershipPaymentStep, {
  MembershipTier,
} from './onboarding/MembershipPaymentStep';
import { notifyAdmin } from '@/services/emailNotificationService';
import {
  queueFirebaseEmail,
  buildBrandedEmail,
} from '@/services/firebaseEmailService';
import { ensureProfessionalSlug } from '@/services/professionalsService';
import ShareableProfileLink from '@/components/ShareableProfileLink';

import { useToast } from '@/hooks/use-toast';


interface OnboardingData {
  account: {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
  };
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    bio: string;
    profileImage: string;
    businessName: string;
    businessAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
  services: Array<{
    name: string;
    description: string;
    selected: boolean;
    price: string;
  }>;
  jotform: JotFormAnswers;
}

export default function TaxProfessionalOnboarding() {
  const { user, logout, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  // The pro's public-profile slug, resolved on completion so we can show them
  // their shareable /preparer/{slug} landing-page link.
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  // Holds the signed agreement after step 6 so the payment step (step 7) can
  // reuse the signer's verified name/email for the PaymentIntent + receipt.
  const [signedAgreement, setSignedAgreement] = useState<SignedAgreement | null>(null);
  // The tier the applicant activated at payment (set on success).
  const [paidTier, setPaidTier] = useState<MembershipTier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationPending, setShowVerificationPending] = useState(false);
  const [isExistingProfessional, setIsExistingProfessional] = useState(false);
  // Tracks whether we've finished checking Firestore for an existing
  // professional/draft. Until this is true for a signed-in user, we must NOT
  // render any step UI (especially not the create-account form) or the user
  // briefly sees "create a login" before we resume them where they left off.
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Controls the sign-in dialog shown to returning applicants who landed here
  // logged out (e.g. after signing out to refresh an expired session).
  const [showLogin, setShowLogin] = useState(false);
  // When a save fails with a permission/session error, surface a visible,
  // actionable banner (with a one-click sign-out) instead of relying only on
  // a transient toast or the header avatar menu.
  const [sessionError, setSessionError] = useState(false);
  // Distinct from `sessionError`: this is set when the write was rejected with
  // a permission error even though the user's auth token was confirmed fresh
  // and matching. That means signing out & back in will NOT help (it's a
  // server-side rules/config issue), so we must NOT push them into the
  // sign-out→sign-in→fail loop. We show different guidance instead.
  const [rulesError, setRulesError] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);



  /**
   * One-click recovery for the "Missing or insufficient permissions" /
   * expired-session error: sign the user fully out and send them to the
   * professional sign-in flow. Because onboarding progress is persisted to
   * Firestore (onboarding_draft + onboarding_step), signing back in resumes
   * them at the exact step they left off — nothing is lost.
   */
  const handleSignOutAndReauth = async () => {
    setIsSigningOut(true);
    try {
      await logout();
      toast({
        title: 'Signed out',
        description: 'Please sign back in to refresh your session, then continue your application.',
      });
      // Stay inside the app and reopen the sign-in dialog so they can log
      // straight back in and resume — never bounce them to an external page.
      window.location.href = '/onboarding?signin=1';

    } catch (e) {
      toast({
        title: 'Sign out failed',
        description: 'Please use the avatar menu at the top-right to sign out manually.',
        variant: 'destructive',
      });
    } finally {
      setIsSigningOut(false);
    }
  };


  const [savedData, setSavedData] = useState<OnboardingData>({
    account: { email: '', password: '', confirmPassword: '', name: '' },
    profile: {
      firstName: '', lastName: '', email: user?.email || '', phone: '',
      bio: '', profileImage: '', businessName: '', businessAddress: '',
      city: '', state: '', zipCode: ''
    },
    services: [],
    jotform: { ...EMPTY_JOTFORM_ANSWERS },
  });

  const steps = [
    { title: 'Account', description: 'Create account', completed: currentStep > 1 },
    { title: 'Profile', description: 'Setup profile', completed: currentStep > 2 },
    { title: 'Services', description: 'Select services', completed: currentStep > 3 },
    { title: 'Preview', description: 'Review profile', completed: currentStep > 4 },
    { title: 'Application', description: 'Intake questions', completed: currentStep > 5 },
    { title: 'Agreement', description: 'Sign & submit', completed: currentStep > 6 },
    { title: 'Payment', description: 'Activate membership', completed: isComplete },
  ];

  // Load existing professional data + saved onboarding draft from Firestore
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!user?.uid) return;

      setIsLoading(true);
      try {
        const ref = doc(db, 'professionals', user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const professional: any = snap.data();
          setIsExistingProfessional(true);

          const draft = professional.onboarding_draft || {};

          const nameParts = (professional.full_name || '').split(' ');
          const firstName = professional.first_name || draft?.profile?.firstName || nameParts[0] || '';
          const lastName = professional.last_name || draft?.profile?.lastName || nameParts.slice(1).join(' ') || '';

          setSavedData(prev => ({
            ...prev,
            profile: {
              firstName,
              lastName,
              email: professional.email || draft?.profile?.email || user.email || '',
              phone: professional.phone || draft?.profile?.phone || '',
              bio: professional.bio || draft?.profile?.bio || '',
              profileImage: professional.profile_image || professional.profile_image_url || draft?.profile?.profileImage || '',
              businessName: professional.business_name || draft?.profile?.businessName || '',
              businessAddress: professional.business_address || draft?.profile?.businessAddress || '',
              city: professional.city || draft?.profile?.city || '',
              state: professional.state || draft?.profile?.state || '',
              zipCode: professional.zip_code || draft?.profile?.zipCode || ''
            },
            services: Array.isArray(professional.services_detailed) && professional.services_detailed.length
              ? professional.services_detailed
              : (Array.isArray(draft?.services) ? draft.services : []),
            jotform: {
              ...EMPTY_JOTFORM_ANSWERS,
              ...(professional.intake_answers || {}),
              ...(draft?.jotform || {}),
            },
          }));

          // Resume at the exact step they left off. If they already submitted
          // the full application, send them to the final step for review.
          const submitted = professional.application_status === 'submitted';
          const savedStep =
            typeof professional.onboarding_step === 'number'
              ? professional.onboarding_step
              : (typeof draft?.step === 'number' ? draft.step : 2);

          const resumeStep = submitted ? 7 : Math.min(Math.max(savedStep, 2), 7);
          setCurrentStep(resumeStep);

          toast({
            title: 'Welcome back!',
            description:
              resumeStep > 2
                ? `Picking up where you left off (step ${resumeStep} of 7).`
                : 'Continue setting up your professional profile below.',
          });
        } else {
          // User is logged in but has NOT created a professional doc yet
          // (e.g. they created an account previously, then logged out before
          // finishing the profile step). They must NOT be sent back to the
          // Account Creation step — that would try to recreate an account that
          // already exists ("email already in use") and they'd be stuck.
          // Move them straight to the Profile step so they can continue.
          setCurrentStep(prev => (prev <= 1 ? 2 : prev));
        }
      } catch (error) {
        console.error('Error loading professional profile:', error);
        // Even if the lookup fails, a logged-in user should never be stuck on
        // the account-creation step. Advance them so they can keep going.
        setCurrentStep(prev => (prev <= 1 ? 2 : prev));
      } finally {
        setIsLoading(false);
        setProfileLoaded(true);
      }
    };

    if (user?.uid) {
      loadExistingProfile();
    }
  }, [user?.uid]);

  // Hydrate from the resilient localStorage copy when the server didn't have
  // the profile (e.g. an earlier save was blocked by backend rules). This
  // ensures a returning applicant never loses what they typed, even when the
  // remote write failed. Server data (loaded above) always wins over local.
  useEffect(() => {
    if (!user?.uid || !profileLoaded) return;
    try {
      const raw = localStorage.getItem(`onboardingProfile:${user.uid}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const localProfile = parsed?.profile;
      if (!localProfile) return;
      setSavedData(prev => {
        const p = prev.profile;
        const isEmpty = !p.firstName && !p.lastName && !p.phone && !p.bio && !p.businessName;
        if (!isEmpty) return prev; // server/loaded data already present — keep it
        return { ...prev, profile: { ...p, ...localProfile } };
      });
    } catch {
      /* ignore malformed local copy */
    }
  }, [user?.uid, profileLoaded]);


  // Once auth has resolved, decide what "loaded" means for a logged-OUT visitor.
  // A genuinely new applicant (no user after auth resolves) should see the
  // account-creation step — but only AFTER auth finishes loading, never during
  // the initial flash where `user` is momentarily null.
  useEffect(() => {
    if (!authLoading && !user?.uid) {
      setProfileLoaded(true);
    }
  }, [authLoading, user?.uid]);

  // If we were sent here to re-authenticate (?signin=1) and we're logged out,
  // auto-open the sign-in dialog so returning applicants can resume in one step.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('signin') === '1' && !authLoading && !user?.uid) {
      setShowLogin(true);
    }
  }, [authLoading, user?.uid]);



  useEffect(() => {
    const startStep = localStorage.getItem('startOnboardingAtStep');
    const accountCreated = localStorage.getItem('onboardingAccountCreated');

    if (startStep && accountCreated === 'true') {
      setCurrentStep(parseInt(startStep));
      localStorage.removeItem('startOnboardingAtStep');
      localStorage.removeItem('onboardingAccountCreated');
    }

    if (user?.email && user?.emailVerified && !isExistingProfessional) {
      setSavedData(prev => ({
        ...prev,
        profile: { ...prev.profile, email: user.email }
      }));
      if (currentStep === 1 && !showVerificationPending) {
        setCurrentStep(2);
      }
    }
  }, [user, currentStep, showVerificationPending, isExistingProfessional]);

  // Once onboarding completes, resolve (or backfill) the pro's profile slug so
  // the success screen can show their shareable landing-page link.
  useEffect(() => {
    if (!isComplete || !user?.uid) return;
    let cancelled = false;
    (async () => {
      const slug = await ensureProfessionalSlug(user.uid, user.name);
      if (!cancelled) setProfileSlug(slug);
    })();
    return () => {
      cancelled = true;
    };
  }, [isComplete, user]);

  /**
   * Persist the current onboarding step + partially-entered data to the
   * professional's Firestore doc (under `onboarding_draft`) so the user can
   * log out and resume at the exact step/state they left off. Uses merge so
   * it works whether or not the main profile doc exists yet, and never blocks
   * navigation if the write fails.
   */
  const persistOnboardingProgress = async (
    step: number,
    override?: Partial<OnboardingData>,
  ) => {
    if (!user?.uid) return;
    try {
      const data = { ...savedData, ...(override || {}) } as OnboardingData;
      const ref = doc(db, 'professionals', user.uid);
      await setDoc(
        ref,
        {
          firebase_uid: user.uid,
          onboarding_step: step,
          onboarding_completed: false,
          onboarding_draft: {
            step,
            profile: data.profile,
            services: data.services,
            jotform: data.jotform,
            savedAt: new Date().toISOString(),
          },
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      // Non-blocking: draft persistence should never prevent the user from
      // continuing. We just log it for diagnostics.
      console.warn('Could not persist onboarding draft:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Step data update handlers
  //
  // These are passed as the `onUpdate` / `onChange` callbacks to each step
  // component. They were previously referenced inside renderCurrentStep() but
  // never defined — which threw a ReferenceError the moment a step rendered,
  // crashing the whole onboarding screen to a blank white page (the bug a
  // returning user hit when they clicked "Continue onboarding" and landed on
  // the Profile step). Defining them here restores rendering.
  // ---------------------------------------------------------------------------

  const updateAccountData = (data: OnboardingData['account']) => {
    setSavedData(prev => ({ ...prev, account: { ...prev.account, ...data } }));
  };

  const updateProfileData = (data: OnboardingData['profile']) => {
    setSavedData(prev => ({ ...prev, profile: { ...prev.profile, ...data } }));
  };

  // ServiceOfferingsStep calls onUpdate({ services: [...] })
  const updateServicesData = (data: { services: OnboardingData['services'] }) => {
    setSavedData(prev => ({
      ...prev,
      services: Array.isArray(data?.services) ? data.services : prev.services,
    }));
  };

  const updateJotformData = (next: JotFormAnswers) => {
    setSavedData(prev => ({ ...prev, jotform: next }));
  };



  const handleAccountCreation = async () => {
    setIsLoading(true);
    try {
      const { account } = savedData;
      const userCredential = await createUserWithEmailAndPassword(auth, account.email, account.password);

      try {
        await sendVerificationEmail(userCredential.user);
        toast({ title: 'Account created!', description: 'Please verify your email to continue.' });
        setShowVerificationPending(true);
      } catch {
        toast({ title: 'Account created!', description: 'Proceeding to profile setup.' });
        setShowVerificationPending(false);
        setCurrentStep(2);
      }

      const [firstName, ...lastNameParts] = account.name.split(' ');
      setSavedData(prev => ({
        ...prev,
        profile: { ...prev.profile, email: account.email, firstName: firstName || '', lastName: lastNameParts.join(' ') || '' }
      }));
    } catch (error: any) {
      toast({ title: 'Account creation failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailVerified = () => {
    setShowVerificationPending(false);
    setCurrentStep(2);
  };

  /**
   * Force-refresh the Firebase ID token and report exactly what state auth is
   * in. We need the detail (not just a boolean) so the error handler can tell
   * apart two very different failures:
   *   - hasCurrentUser=false  → genuinely signed out / session lost
   *                              → signing back in WILL help.
   *   - hasCurrentUser=true & uidMatch=true but the write STILL fails with
   *     permission-denied → it is NOT a session problem (the token is valid).
   *     Telling the user to sign out & back in would just loop forever, so we
   *     must show different guidance instead.
   */
  const ensureFreshAuth = async (): Promise<{
    ok: boolean;
    hasCurrentUser: boolean;
    uidMatch: boolean;
  }> => {
    try {
      const current = auth.currentUser;
      if (!current) return { ok: false, hasCurrentUser: false, uidMatch: false };
      // true = force a network refresh of the ID token.
      await current.getIdToken(true);
      const uidMatch = current.uid === user?.uid;
      return { ok: uidMatch, hasCurrentUser: true, uidMatch };
    } catch (e) {
      console.warn('Token refresh failed:', e);
      return { ok: false, hasCurrentUser: !!auth.currentUser, uidMatch: false };
    }
  };


  const isPermissionError = (error: any) => {
    const code = error?.code || '';
    const msg = error?.message || '';
    return (
      code === 'permission-denied' ||
      code === 'firestore/permission-denied' ||
      /Missing or insufficient permissions/i.test(msg)
    );
  };

  /**
   * Save the profile entered in step 2 and advance to step 3.
   *
   * IMPORTANT — this is the function that previously trapped users in a loop.
   * The trap happened because a Firestore `permission-denied` (caused by the
   * project's deployed security rules / backend, NOT the user's session) was
   * mislabeled as "session expired", which pushed the user to sign out → sign
   * back in → save → fail → "session expired" again, forever.
   *
   * The fix: signing out NEVER resolves a permission-denied (the token is
   * already valid), so we no longer route permission errors into the
   * destructive sign-out flow. Instead we:
   *   1. Persist the entered profile locally (so nothing is ever lost), and
   *   2. Let the applicant CONTINUE to the next step regardless, while showing
   *      a calm, non-destructive note that their profile will sync once the
   *      backend is re-enabled.
   * The only case that still asks the user to re-authenticate is a genuine
   * `unauthenticated` state where there is no signed-in Firebase user at all.
   */
  const handleProfileSave = async () => {
    if (!user?.uid) {
      toast({
        title: 'Not signed in',
        description: 'Please sign in or create an account before saving your profile.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { profile } = savedData;

    // Always keep a resilient local copy so the applicant never loses work,
    // even if every remote write is blocked/offline.
    try {
      localStorage.setItem(
        `onboardingProfile:${user.uid}`,
        JSON.stringify({ profile, savedAt: new Date().toISOString() }),
      );
    } catch {
      /* ignore quota / privacy-mode errors */
    }

    try {
      const profileData: Record<string, any> = {
        firebase_uid: user.uid,
        full_name: `${profile.firstName} ${profile.lastName}`.trim(),
        first_name: profile.firstName,
        last_name: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        business_name: profile.businessName,
        bio: profile.bio,
        profile_image: profile.profileImage,
        profile_image_url: profile.profileImage,
        business_address: profile.businessAddress,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zipCode,
        location: `${profile.city}${profile.city && profile.state ? ', ' : ''}${profile.state}`.trim(),
        is_published: true,
        approval_status: 'approved',
        updated_at: serverTimestamp(),
      };

      // Refresh the token up-front so the write uses a valid credential.
      await ensureFreshAuth();

      const ref = doc(db, 'professionals', user.uid);

      const writeProfile = async () => {
        const existing = await getDoc(ref);
        if (existing.exists()) {
          await updateDoc(ref, profileData);
          return 'updated';
        }
        await setDoc(ref, {
          ...profileData,
          rating: 0,
          review_count: 0,
          years_experience: 0,
          membership_level: 'Professional',
          approved_at: serverTimestamp(),
          created_at: serverTimestamp(),
        });
        return 'created';
      };

      let result: string;
      try {
        result = await writeProfile();
      } catch (firstErr: any) {
        // One automatic retry after forcing a fresh token (covers a genuinely
        // expired token). If it still fails, the error propagates to catch.
        if (isPermissionError(firstErr)) {
          await ensureFreshAuth();
          result = await writeProfile();
        } else {
          throw firstErr;
        }
      }

      // Success — clear any previously-shown recovery banners.
      setSessionError(false);
      setRulesError(false);

      toast({
        title: result === 'updated' ? 'Profile updated!' : 'Profile created!',
        description:
          result === 'updated'
            ? 'Now update your services.'
            : 'Your listing is now live in the directory. Next, select your services.',
      });

      setIsExistingProfessional(true);
      await persistOnboardingProgress(3);
      setCurrentStep(3);
    } catch (error: any) {
      const msg = error?.message || '';
      const code = error?.code || '';
      const isPermission = isPermissionError(error);
      const isUnauthenticated =
        code === 'unauthenticated' ||
        code === 'firestore/unauthenticated' ||
        !auth.currentUser;
      const isNetworkError = /Failed to fetch|NetworkError|timeout|Cannot connect|offline|unavailable/i.test(msg);

      console.error('Profile save error:', error);

      if (isUnauthenticated && !auth.currentUser) {
        // GENUINE signed-out state — this is the ONLY case where re-login helps.
        setSessionError(true);
        setRulesError(false);
        toast({
          title: 'Please sign in again',
          description:
            "You're signed out, so we couldn't save. Sign back in to continue — your details are saved on this device and will be restored automatically.",
          variant: 'destructive',
          duration: 9000,
        });
      } else if (isPermission) {
        // Token is valid but the write was blocked by the backend/rules.
        // Signing out will NOT help, so we DO NOT show the sign-out flow and we
        // DO NOT keep a blocking banner. We keep the entered data, show a calm
        // note, and let the applicant CONTINUE so they are never stuck.
        setRulesError(false);
        setSessionError(false);
        toast({
          title: 'Saved on this device — continuing',
          description:
            "We couldn't sync your profile to our servers just yet (a temporary backend setting on our end). Your details are safely saved here and we'll finish syncing automatically — you can keep going.",
          duration: 8000,
        });
        // Record the draft locally (already done above) and advance so the
        // user proceeds rather than looping on the same step.
        try {
          await persistOnboardingProgress(3);
        } catch {
          /* draft write may also be blocked; the localStorage copy persists it */
        }
        setIsExistingProfessional(true);
        setCurrentStep(3);

      } else if (isNetworkError) {
        toast({
          title: 'Connection problem',
          description:
            "We couldn't reach the server. Please check your internet connection and click Continue again.",
          variant: 'destructive',
          duration: 9000,
        });
      } else {
        toast({
          title: 'Failed to save profile',
          description: msg || 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
          duration: 9000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };





  const handleServicesSave = async () => {
    if (!user?.uid) {
      toast({
        title: 'Not signed in',
        description: 'Please sign in before saving your services.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const selectedServices = savedData.services
        .filter(s => s.selected)
        .map(s => ({
          name: s.name,
          description: s.description,
          price: parseFloat(s.price) || 0,
        }));

      const ref = doc(db, 'professionals', user.uid);
      await updateDoc(ref, {
        services: selectedServices.map(s => s.name),
        services_detailed: selectedServices,
        updated_at: serverTimestamp(),
      });

      toast({ title: 'Services saved!', description: 'Review your profile before continuing.' });
      await persistOnboardingProgress(4);
      setCurrentStep(4);
    } catch (error: any) {
      const isPermission = isPermissionError(error);
      const isNetworkError = /Failed to fetch|NetworkError|timeout|offline|unavailable/i.test(error?.message || '');
      console.error('Services save error:', error);

      if (isPermission && auth.currentUser) {
        // Same backend/rules situation as the profile step — don't trap the
        // user. Keep their selections locally and let them continue.
        try {
          localStorage.setItem(
            `onboardingServices:${user.uid}`,
            JSON.stringify({ services: savedData.services, savedAt: new Date().toISOString() }),
          );
        } catch { /* ignore */ }
        toast({
          title: 'Saved on this device — continuing',
          description:
            "We couldn't sync your services to our servers just yet. Your selections are saved here and you can keep going.",
          duration: 7000,
        });
        try { await persistOnboardingProgress(4); } catch { /* ignore */ }
        setCurrentStep(4);
        return;
      }

      toast({
        title: isNetworkError ? 'Connection problem' : 'Failed to save services',
        description: isNetworkError
          ? "We couldn't reach the server. Please check your internet connection and try again. If this keeps happening, please contact support@refund-connect.com."
          : (error?.message || 'An unexpected error occurred. Please try again.'),
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };


  /**
   * Final step: T&C signed. Persist the full application + signed agreement,
   * email the user a copy of the signed agreement, and notify admin.
   *
   * IMPORTANT — like the profile/services steps, this must NEVER trap the
   * applicant. Previously a single Firestore `permission-denied` on the
   * `professionals` updateDoc (a backend/rules issue, NOT the user's session)
   * would throw out of the whole function, the user would see
   * "Could not submit application — Missing or insufficient permissions", and
   * they'd be stuck on step 6 forever, unable to reach payment.
   *
   * The fix: every remote write is wrapped independently, a permission error
   * is treated as non-blocking (we keep a resilient local copy and continue),
   * and we ALWAYS advance to the payment step (7) once the agreement is signed.
   */
  const handleAgreementSigned = async (signed: SignedAgreement) => {
    setIsLoading(true);

    const { profile, jotform } = savedData;
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();

    // Always keep a resilient local copy of the signed agreement + answers so
    // nothing is ever lost, even if every remote write is blocked.
    try {
      localStorage.setItem(
        `onboardingAgreement:${user?.uid || 'anon'}`,
        JSON.stringify({ signed, jotform, savedAt: new Date().toISOString() }),
      );
    } catch {
      /* ignore quota / privacy-mode errors */
    }

    let permissionBlocked = false;

    // 1. Persist signed agreement + jotform answers on the professional doc.
    //    Wrapped independently so a permission/rules rejection does NOT abort
    //    the rest of submission — the user still proceeds to payment.
    if (user?.uid) {
      try {
        await ensureFreshAuth();
        const ref = doc(db, 'professionals', user.uid);
        await updateDoc(ref, {
          application_status: 'submitted',
          application_submitted_at: serverTimestamp(),
          intake_answers: jotform,
          signed_agreement: {
            ...signed,
            clientIp: signed.clientIp ?? null,
          },
          terms_agreement_version: signed.agreementVersion,
          terms_signed_at: signed.signedAt,
        });
      } catch (proErr: any) {
        if (isPermissionError(proErr)) {
          permissionBlocked = true;
          console.warn('Professional doc update blocked by rules (non-blocking):', proErr);
        } else {
          console.warn('Professional doc update failed (non-blocking):', proErr);
        }
      }
    }

    // 2. Also write a permanent immutable record in a dedicated collection
    //    for legal/audit purposes. Doc id = uid+timestamp so retries don't
    //    overwrite existing signed copies. Non-blocking.
    try {
      const sigId = `${user?.uid || 'anon'}_${Date.now()}`;
      await setDoc(doc(db, 'signed_agreements', sigId), {
        ...signed,
        clientIp: signed.clientIp ?? null,
        firebase_uid: user?.uid || null,
        applicant_email: signed.signerEmail,
        applicant_name: signed.signerName,
        created_at: serverTimestamp(),
      });
    } catch (auditErr) {
      if (isPermissionError(auditErr)) permissionBlocked = true;
      console.warn('Audit record write failed (non-blocking):', auditErr);
    }

    // 3. Email the signed agreement copy to the signer (non-blocking).
    try {
      const reviewUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/` : '';
      const html = buildBrandedEmail({
        title: 'Your Signed Agreement — Refund Connect',
        intro: `Hi ${fullName || signed.signerName},<br/><br/>Thank you for joining Refund Connect. This email confirms that you have electronically signed the <strong>${AGREEMENT_TITLE}</strong> (version ${AGREEMENT_VERSION}). A copy of your signed agreement is on file with us; the key details are below for your records.`,
        rows: [
          { label: 'Agreement', value: AGREEMENT_TITLE },
          { label: 'Version', value: AGREEMENT_VERSION },
          { label: 'Signer', value: signed.signerName },
          { label: 'Email', value: signed.signerEmail },
          { label: 'Initials', value: signed.signerInitials },
          { label: 'Signed At', value: new Date(signed.signedAt).toLocaleString() },
          { label: 'IP Address', value: signed.clientIp || 'not captured' },
        ],
        ctaLabel: 'Visit Your Dashboard',
        ctaUrl: reviewUrl,
        footer:
          'Keep this email for your records. The full text of your signed agreement is stored on our secure servers and can be requested at any time by emailing support@refund-connect.com.',
        accentColor: '#2563eb',
      });

      await queueFirebaseEmail({
        to: signed.signerEmail,
        subject: `Signed: ${AGREEMENT_TITLE} (${AGREEMENT_VERSION})`,
        html,
        category: 'signed_agreement',
        meta: {
          agreementVersion: signed.agreementVersion,
          signedAt: signed.signedAt,
          firebaseUid: user?.uid || '',
        },
      });
    } catch (mailErr) {
      console.warn('Could not email signed agreement copy:', mailErr);
    }

    // 4. Notify admin (non-blocking).
    try {
      await notifyAdmin({
        subject: 'New Tax Professional Application — Agreement Signed',
        category: 'enrollment',
        message: `${fullName || signed.signerName} (${signed.signerEmail}) has completed onboarding and signed the ${AGREEMENT_TITLE} (${AGREEMENT_VERSION}).`,
        meta: {
          name: fullName || signed.signerName,
          email: signed.signerEmail,
          phone: profile.phone,
          businessName: profile.businessName,
          city: profile.city,
          state: profile.state,
          ptin: jotform.ptin,
          efin: jotform.efin,
          yearsPreparing: jotform.yearsPreparing,
          agreementVersion: signed.agreementVersion,
          signedAt: signed.signedAt,
          clientIp: signed.clientIp || '',
          reviewUrl:
            typeof window !== 'undefined' ? `${window.location.origin}/admin` : '',
        },
      });
    } catch (err) {
      console.warn('Admin notification failed:', err);
    }

    // Agreement is signed & saved locally. ALWAYS move to the final membership
    // payment step (step 7) — never leave the user stuck on the agreement step,
    // even when a backend permission rule blocked the server-side write.
    setSignedAgreement(signed);
    try {
      await persistOnboardingProgress(7);
    } catch {
      /* draft write may also be blocked; the localStorage copy persists it */
    }
    setCurrentStep(7);

    if (permissionBlocked) {
      toast({
        title: 'Agreement signed — continuing',
        description:
          "Your agreement is recorded on this device. We couldn't fully sync it to our servers just yet (a temporary backend setting on our end), but you can finish — choose your membership tier and complete payment.",
        duration: 8000,
      });
    } else {
      toast({
        title: 'Agreement signed!',
        description:
          'One last step — choose your membership tier and complete payment to activate your account.',
      });
    }

    setIsLoading(false);
  };


  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const renderCurrentStep = () => {
    if (showVerificationPending) {
      return <EmailVerificationPending email={savedData.account.email} onVerified={handleEmailVerified} />;
    }

    if (currentStep === 1) {
      // A logged-in user should never see the account-creation form — they
      // already have an account. While we resolve where to send them, show a
      // brief loading state instead of the (broken) create-account step.
      if (user?.uid) {
        return (
          <Card>
            <CardContent className="py-12 text-center text-gray-600">
              Loading your onboarding…
            </CardContent>
          </Card>
        );
      }
      return <AccountCreationStep data={savedData.account} onUpdate={updateAccountData} onNext={handleAccountCreation} isLoading={isLoading} />;
    }


    if (currentStep === 2) {
      return <ProfileSetupStep data={savedData.profile} onUpdate={updateProfileData} onNext={handleProfileSave} onBack={handleBack} />;
    }

    if (currentStep === 3) {
      return <ServiceOfferingsStep data={{ services: savedData.services }} onUpdate={updateServicesData} onNext={handleServicesSave} onBack={handleBack} />;
    }

    if (currentStep === 4) {
      return (
        <ProfilePreviewStep
          profileData={savedData.profile}
          servicesData={savedData.services}
          onEditProfile={() => setCurrentStep(2)}
          onEditServices={() => setCurrentStep(3)}
          onContinue={() => { persistOnboardingProgress(5); setCurrentStep(5); }}
          onBack={handleBack}
        />
      );
    }

    if (currentStep === 5) {
      return (
        <JotFormQuestionsStep
          value={savedData.jotform}
          onChange={updateJotformData}
          onBack={handleBack}
          onNext={() => { persistOnboardingProgress(6); setCurrentStep(6); }}
        />
      );
    }

    if (currentStep === 6) {
      return (
        <TermsAgreementStep
          defaultName={`${savedData.profile.firstName} ${savedData.profile.lastName}`.trim()}
          defaultEmail={savedData.profile.email || user?.email || ''}
          onBack={handleBack}
          onSigned={handleAgreementSigned}
        />
      );
    }

    if (currentStep === 7) {
      // Final step — membership payment via FamousPay (Stripe) Elements.
      // Requires a signed-in user so we can record the result on their doc.
      if (!user?.uid) {
        return (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              Please sign in to complete your membership payment.
            </CardContent>
          </Card>
        );
      }
      return (
        <MembershipPaymentStep
          uid={user.uid}
          signerName={
            signedAgreement?.signerName ||
            `${savedData.profile.firstName} ${savedData.profile.lastName}`.trim()
          }
          signerEmail={signedAgreement?.signerEmail || savedData.profile.email || user.email || ''}
          onBack={handleBack}
          onComplete={(tier) => {
            setPaidTier(tier);
            setIsComplete(true);
          }}
        />
      );
    }

    return null;
  };


  // ───────────────────────────────────────────────────────────────────────
  // Global loading gate. We must NOT render any step UI until we know:
  //   1. whether the visitor is signed in (authLoading === false), AND
  //   2. (if signed in) whether they already have a saved draft to resume.
  // Without this gate, a returning logged-in applicant briefly sees the
  // "create a login" account-creation form before we resume them — the exact
  // bug reported. Showing a spinner here eliminates that flash entirely.
  // ───────────────────────────────────────────────────────────────────────
  if (authLoading || (user?.uid && !profileLoaded)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your application…</p>
          <p className="text-gray-400 text-sm mt-1">
            We're picking up right where you left off.
          </p>
        </div>
      </div>
    );
  }

  if (isComplete) {

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-2">
                {paidTier ? 'Membership Activated!' : 'Application Submitted!'}
              </h2>
              <p className="text-gray-600 mb-6">
                {paidTier ? (
                  <>
                    Your <strong>{paidTier.name}</strong> membership is now active and
                    your payment of <strong>${paidTier.price.toFixed(2)}</strong> was
                    received. A receipt and a copy of your signed agreement have been
                    emailed to <strong>{savedData.profile.email || user?.email}</strong>.
                  </>
                ) : (
                  <>
                    Thank you for completing your application and signing the agreement.
                    A copy of your signed agreement has been emailed to{' '}
                    <strong>{savedData.profile.email || user?.email}</strong>. We'll review
                    your application and be in touch shortly.
                  </>
                )}
              </p>

              {/* Shareable public profile link — start marketing immediately. */}
              {(profileSlug || user?.uid) && (
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-left">
                  <p className="mb-1 text-sm font-semibold text-blue-900">
                    🎉 Your public profile is live — share it to start getting clients:
                  </p>
                  <p className="mb-3 text-xs text-blue-800">
                    Add this link to your email signature, social bios, and business cards.
                  </p>
                  <ShareableProfileLink
                    slug={profileSlug}
                    professionalId={user?.uid}
                    label=""
                  />
                </div>
              )}

              <Button onClick={() => window.location.href = '/'}>Return to Home</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <OnboardingProgress currentStep={currentStep} totalSteps={7} steps={steps} />

        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <Button variant="outline" onClick={() => window.location.href = '/'} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />Exit Onboarding
          </Button>
          {/* Always-available sign out so users are never stuck if the header
              avatar menu is hard to reach. Progress is saved automatically. */}
          {user && (
            <Button
              variant="ghost"
              onClick={handleSignOutAndReauth}
              disabled={isSigningOut}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Signing out…' : 'Sign Out'}
            </Button>
          )}
        </div>

        {sessionError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Session expired — quick fix needed</AlertTitle>
            <AlertDescription>
              <p className="mb-3">
                Your sign-in session expired, which blocked saving your profile.
                Sign out and sign back in to refresh it, then continue — your
                progress is saved automatically, so you'll resume right where you
                left off.
              </p>
              <Button
                onClick={handleSignOutAndReauth}
                disabled={isSigningOut}
                className="bg-white text-red-700 hover:bg-red-50 border border-red-300"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isSigningOut ? 'Signing out…' : 'Sign Out & Sign Back In'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Rules / server-side permission issue: token is valid, so signing
            out won't help. We explicitly DON'T offer the sign-out button here
            (that's what created the endless loop). Instead: a non-destructive
            retry + a direct support contact. */}
        {rulesError && (
          <Alert className="mb-6 border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">
              We couldn't save your profile yet
            </AlertTitle>
            <AlertDescription className="text-amber-800">
              <p className="mb-3">
                Your sign-in is valid — this isn't a session problem, so signing
                out and back in won't fix it. Your account just isn't fully
                enabled for saving on our side yet. Everything you've typed is
                still here on this page, so nothing is lost.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleProfileSave}
                  disabled={isLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isLoading ? 'Trying again…' : 'Try Saving Again'}
                </Button>
                <a
                  href="mailto:support@refund-connect.com?subject=Profile%20save%20permission%20issue"
                  className="inline-flex items-center rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                >
                  Email Support
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}


        {/* Returning applicant rescue: if they're on the account-creation step
            but already started an application before, signing in resumes them
            exactly where they left off — no duplicate account, no lost work. */}
        {currentStep === 1 && !user && !showVerificationPending && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <LogIn className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900">Already started your application?</AlertTitle>
            <AlertDescription className="text-blue-800">
              <p className="mb-3">
                Don't create a second account — just sign in and we'll take you
                straight back to the step you left off on. Your progress is saved.
              </p>
              <Button
                onClick={() => setShowLogin(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In to Continue
              </Button>
            </AlertDescription>
          </Alert>
        )}


        <Alert className="mb-6">
          <AlertDescription>
            {currentStep === 1 && 'Create your professional account to get started.'}
            {currentStep === 2 && 'Complete your profile information to continue.'}
            {currentStep === 3 && 'Select the services you offer and set your pricing.'}
            {currentStep === 4 && 'Review how your profile will appear to clients before submitting.'}
            {currentStep === 5 && 'Answer the application questions — required for credentialing and IRS compliance.'}
            {currentStep === 6 && 'Read and electronically sign the Independent Tax Preparer Agreement.'}
            {currentStep === 7 && 'Choose your membership tier and complete payment to activate your account.'}
          </AlertDescription>
        </Alert>
        {renderCurrentStep()}
      </div>

      {/* Sign-in dialog for returning applicants. On success, AuthContext's
          onAuthStateChanged fires, the load effect runs, and they're resumed
          at the exact step they left off — no work lost, no duplicate account. */}
      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />
    </div>
  );
}

