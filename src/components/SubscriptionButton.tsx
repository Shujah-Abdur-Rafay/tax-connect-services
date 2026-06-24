import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import EnrollmentForm, { type EnrollmentData } from '@/components/EnrollmentForm';
import TaxProMembershipPlans from '@/components/TaxProMembershipPlans';
import { submitEnrollmentApplication } from '@/services/enrollmentService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { notifySubscriptionCreated, notifyPaymentSuccess } from '@/utils/subscriptionNotifications';

interface SubscriptionButtonProps {
  className?: string;
  children: React.ReactNode;
}




const SubscriptionButton: React.FC<SubscriptionButtonProps> = ({
  className,
  children
}) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'enrollment' | 'payment'>('enrollment');
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleEnrollmentSubmit = async (data: EnrollmentData) => {
    try {
      setLoading(true);

      // Save the application to Firestore (replaces Supabase)
      const { id } = await submitEnrollmentApplication({
        email: data.email,
        profile: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          businessName: data.businessName,
          website: data.website,
          bio: data.bio,
          profilePhoto: data.profilePhoto,
          experienceLevel: data.experienceLevel,
          priorYearBankProducts: data.priorYearBankProducts,
        },
        services: {
          services: data.servicesOffered,
        },
        credentials: {
          ptin: data.ptin,
          efin: data.efin,
          hasEfin: data.hasEfin,
          credentials: data.credentials,
          yearsPreparing: data.yearsPreparing,
          returnsLastSeason: data.returnsLastSeason,
          softwareUsed: data.softwareUsed,
          workSetup: data.workSetup,
          hoursPerWeek: data.hoursPerWeek,
          referralSource: data.referralSource,
          felonyDisclosure: data.felonyDisclosure,
          circular230Ack: data.circular230Ack,
        },
        pricing: {},
        availability: {},
      });


      setApplicationId(id);
      setEnrollmentData(data);

      // Also forward to CRM so the project owner is notified of the new applicant
      try {
        await fetch(
          'https://famous.ai/api/crm/68a3939608e7f1e2bfd480c9/subscribe',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: data.email,
              name: `${data.firstName} ${data.lastName}`.trim(),
              source: 'enrollment-form',
              tags: ['tax-professional-applicant'],
            }),
          }
        );
      } catch (crmErr) {
        // non-fatal — don't block the user
        console.warn('CRM subscribe failed (non-fatal):', crmErr);
      }

      toast({
        title: 'Application submitted!',
        description: 'Your enrollment details were saved. Now choose your plan.',
      });

      setStep('payment');
    } catch (error: any) {
      console.error('Enrollment submission error:', error);
      const msg = error?.message || '';
      const isNetwork =
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('network');

      toast({
        title: 'Could not submit application',
        description: isNetwork
          ? 'Connection issue. Please check your internet and try again. If the issue persists, contact info@alliance-tax.com.'
          : msg || 'Something went wrong. Please try again.',
        variant: 'destructive',

        duration: 8000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      setLoading(true);

      // Create Firebase notifications
      if (user?.id) {
        await notifySubscriptionCreated(user.id, 'Basic Monthly');
        await notifyPaymentSuccess(user.id, 9.95);
      }

      toast({
        title: 'Welcome to Tax Connect Services!',
        description: 'Your subscription is active. Enjoy 3 months FREE!'
      });

      setOpen(false);
      setStep('enrollment');
      setEnrollmentData(null);
      setApplicationId(null);

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className}>
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-visible">
        <DialogHeader>
          <DialogTitle>
            {step === 'enrollment' ? 'Complete Enrollment' : 'Choose Your Membership'}
          </DialogTitle>
        </DialogHeader>
        {step === 'enrollment' ? (
          <EnrollmentForm onSubmit={handleEnrollmentSubmit} loading={loading} />
        ) : (
          <div className="space-y-6">
            <TaxProMembershipPlans
              applicant={
                enrollmentData
                  ? {
                      name: `${enrollmentData.firstName} ${enrollmentData.lastName}`.trim(),
                      email: enrollmentData.email,
                      phone: enrollmentData.phone,
                      address: [
                        enrollmentData.address,
                        enrollmentData.city,
                        enrollmentData.state,
                        enrollmentData.zip,
                      ]
                        .filter(Boolean)
                        .join(', '),
                      experienceLevel: enrollmentData.experienceLevel,
                      priorYearProducts: enrollmentData.priorYearBankProducts,
                    }
                  : undefined
              }
              onPlanSelect={() => {
                // The plan component handles the redirect to Stripe Checkout itself.
                // We just mark the local flow as complete and surface a success toast.
                handlePaymentSuccess();
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionButton;
