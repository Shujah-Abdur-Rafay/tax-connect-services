import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList } from 'lucide-react';

/**
 * ContinueApplicationBanner
 *
 * A persistent, site-wide banner that surfaces for any signed-in professional
 * whose onboarding application is not yet complete. It deep-links straight to
 * /onboarding so they can resume in a single click from anywhere in the app.
 *
 * Logic:
 *  - Only evaluated for signed-in users with the `professional` role.
 *  - Reads the professional's Firestore doc (`professionals/{uid}`) and checks
 *    `onboarding_completed`. If it is anything other than `true`, the banner
 *    shows. A missing doc is treated as "not completed" (they still need to
 *    start/finish), and a submitted-but-pending application is also surfaced.
 *  - The banner is intentionally persistent (not dismissible) so the call to
 *    finish onboarding stays visible until it is actually completed.
 */
const ContinueApplicationBanner: React.FC = () => {
  const { user, isProfessional, loading } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [resumeStep, setResumeStep] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const check = async () => {
      // Reset before each evaluation.
      if (!active) return;
      setShow(false);
      setResumeStep(null);

      // Only relevant for signed-in professionals once auth has settled.
      if (loading || !user || !isProfessional || !db) return;

      try {
        const snap = await getDoc(doc(db, 'professionals', user.uid));

        if (!active) return;

        if (!snap.exists()) {
          // Professional account with no application started yet.
          setShow(true);
          setResumeStep(null);
          return;
        }

        const data = snap.data() as {
          onboarding_completed?: boolean;
          onboarding_step?: number;
        };

        if (data.onboarding_completed === true) {
          // Application finished — nothing to resume.
          setShow(false);
          return;
        }

        setResumeStep(
          typeof data.onboarding_step === 'number' ? data.onboarding_step : null
        );
        setShow(true);
      } catch (err) {
        // Fail closed: if we can't read the doc, don't nag the user.
        console.error('ContinueApplicationBanner: failed to load status', err);
        if (active) setShow(false);
      }
    };

    check();

    return () => {
      active = false;
    };
  }, [user, isProfessional, loading]);

  if (!show) return null;

  const handleResume = () => {
    navigate('/onboarding');
  };

  // Total number of onboarding steps (mirrors TaxProfessionalOnboarding).
  const TOTAL_STEPS = 7;

  // Derive a clamped, human-friendly current step. A missing/invalid step
  // means they haven't started, so we surface step 1.
  const rawStep =
    typeof resumeStep === 'number' && resumeStep > 0 ? resumeStep : 1;
  const currentStep = Math.min(rawStep, TOTAL_STEPS);

  // Progress is based on steps *completed* (current step - 1) so a user on
  // step 1 sees an honest "just getting started" bar rather than a head start.
  const completedSteps = Math.max(0, currentStep - 1);
  const progressPct = Math.round((completedSteps / TOTAL_STEPS) * 100);
  const stepsLeft = TOTAL_STEPS - currentStep;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="hidden sm:flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div className="w-full">
              <p className="text-sm font-semibold leading-tight">
                Your professional application isn&apos;t finished yet
              </p>
              <p className="text-xs text-blue-100 leading-tight">
                {resumeStep && resumeStep > 0
                  ? 'Pick up right where you left off and get listed.'
                  : 'Complete your onboarding to get listed and start receiving clients.'}
              </p>

              {/* Progress indicator: "Step X of Y" + thin progress bar */}
              <div className="mt-1.5 flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-[11px] font-semibold text-white whitespace-nowrap">
                  Step {currentStep} of {TOTAL_STEPS}
                </span>
                <div
                  className="h-1.5 w-32 sm:w-44 rounded-full bg-white/25 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Onboarding progress"
                >
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[11px] text-blue-100 whitespace-nowrap">
                  {stepsLeft > 0
                    ? `${stepsLeft} step${stepsLeft === 1 ? '' : 's'} left`
                    : 'Almost done'}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={handleResume}
            size="sm"
            className="bg-white text-blue-700 hover:bg-blue-50 font-semibold whitespace-nowrap shadow-sm"
          >
            Continue your application
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ContinueApplicationBanner;

