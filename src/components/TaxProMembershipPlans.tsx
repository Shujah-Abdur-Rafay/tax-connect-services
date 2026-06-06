import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Star, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Tax-Pro Membership Plans
 *
 * Each plan's "Upgrade" button sends the applicant to the hosted onboarding /
 * payment page at https://refund-connect.com/onboarding, which is the final
 * step after the application. The applicant's email and selected tier are
 * forwarded as query params so the onboarding page can pre-fill the form
 * and load the matching Stripe price.
 */

export interface TaxProPlan {
  id: 'associate' | 'professional' | 'premier';
  name: string;
  tagline: string;
  priceYearly: number;
  /** Stripe Price ID — exists in your Stripe dashboard */
  priceId: string;
  /** Onboarding / payment URL (refund-connect.com/onboarding) */
  paymentLinkUrl: string;
  primaryRole: string;
  requirements: string;
  compensation: string;
  features: string[];
  popular?: boolean;
  vip?: boolean;
  borderColor?: string;
}

const ONBOARDING_URL = 'https://refund-connect.com/onboarding';

export const TAX_PRO_PLANS: TaxProPlan[] = [
  {
    id: 'associate',
    name: 'Associate',
    tagline: 'Entry-level — build your tax career',
    priceYearly: 99.95,
    priceId: 'price_1TbWhnH1ygFkeJQLmm2OQOTv',
    paymentLinkUrl: ONBOARDING_URL,
    primaryRole: 'Marketing & client onboarding',
    requirements: 'PTIN required',
    compensation: '$100 for each paid tax return',
    features: [
      'Tax Preparation Certification',
      'Complete Marketing Kit',
      'Professional Tax Software (Retails for $1,495.00)',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For experienced preparers ready to grow',
    priceYearly: 299.95,
    priceId: 'price_1TbWhnH1ygFkeJQLQ6H9fnl5',
    paymentLinkUrl: ONBOARDING_URL,
    primaryRole: 'Marketing & preparing tax returns',
    requirements: '1+ years experience, PTIN required',
    compensation: '$240 – $1,200 per return (~80%)',
    features: [
      'Tax Preparation Certification',
      'Earn 18 CPE Credits — IRS AFSP Accredited',
      'Complete Marketing Kit',
      'Professional Tax Software (Retails for $1,495.00)',
      'Priority Lead Routing',
    ],
    popular: true,
  },
  {
    id: 'premier',
    name: 'Premier Partner',
    tagline: 'For elite preparers with proven success',
    priceYearly: 499.95,
    priceId: 'price_1TbWhnH1ygFkeJQL63WhV1H9',
    paymentLinkUrl: ONBOARDING_URL,
    primaryRole: 'Marketing & preparing tax returns',
    requirements: '2+ years experience, EFIN required',
    compensation: 'Keep 100% of your fees',
    features: [
      'Tax Preparation Certification',
      'Build your own team of preparers',
      'Earn 18 CPE Credits — IRS AFSP Accredited',
      'Complete Marketing Kit',
      'Professional Tax Software (Retails for $1,495.00)',
      'Priority Lead Routing',
    ],
    vip: true,
    borderColor: '#FFD700',
  },
];

export interface TaxProMembershipPlansProps {
  applicant?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    experienceLevel?: string;
    priorYearProducts?: string;
  };
  onPlanSelect?: (planId: TaxProPlan['id'], checkoutUrl: string) => void;
  previewMode?: boolean;
  promoCode?: string;
}

const TaxProMembershipPlans: React.FC<TaxProMembershipPlansProps> = ({
  applicant,
  onPlanSelect,
  previewMode = false,
  promoCode,
}) => {
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<TaxProPlan['id'] | null>(null);

  // Build the onboarding URL with prefilled email + tier metadata via query params.
  const buildCheckoutUrl = (plan: TaxProPlan): string => {
    try {
      const url = new URL(plan.paymentLinkUrl);
      if (applicant?.email) url.searchParams.set('email', applicant.email);
      if (applicant?.name) url.searchParams.set('name', applicant.name);
      if (applicant?.phone) url.searchParams.set('phone', applicant.phone);
      url.searchParams.set('tier', plan.id);
      url.searchParams.set('price_id', plan.priceId);
      if (promoCode) url.searchParams.set('promo', promoCode);
      return url.toString();
    } catch {
      return plan.paymentLinkUrl;
    }
  };

  const handleSubscribe = async (plan: TaxProPlan) => {
    setLoadingId(plan.id);
    try {
      const checkoutUrl = buildCheckoutUrl(plan);

      if (onPlanSelect) onPlanSelect(plan.id, checkoutUrl);

      toast({
        title: 'Redirecting to onboarding…',
        description: `Continuing to ${plan.name} onboarding & payment.`,
      });

      if (previewMode) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (err: any) {
      toast({
        title: 'Could not continue to onboarding',
        description: err?.message || 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge variant="secondary" className="mb-2">
          Billed annually
        </Badge>
        <h3 className="text-2xl font-bold text-gray-900">Choose Your Membership</h3>
        <p className="text-sm text-gray-600 mt-1">
          Same tiers as listed on the public Join Platform page.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {TAX_PRO_PLANS.map((plan) => {
          const isLoading = loadingId === plan.id;
          return (
            <Card
              key={plan.id}
              className={`relative transition-transform hover:-translate-y-1 ${
                plan.popular ? 'border-2 border-blue-500 ring-4 ring-blue-100 shadow-xl' : ''
              }`}
              style={plan.vip ? { borderColor: plan.borderColor, borderWidth: 2 } : undefined}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow">
                    Most Popular
                  </div>
                </div>
              )}
              {plan.vip && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center shadow">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    VIP
                  </div>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-xs text-gray-600">{plan.tagline}</p>
                <div className="text-3xl font-bold text-gray-900 mt-3">
                  ${plan.priceYearly.toFixed(2)}
                </div>
              </CardHeader>


              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  <p><strong>Primary role:</strong> {plan.primaryRole}</p>
                  <p><strong>Requirements:</strong> {plan.requirements}</p>
                  <p><strong>Compensation:</strong> {plan.compensation}</p>
                </div>

                <div className="pt-2">
                  <p className="font-semibold mb-1">Benefits:</p>
                  <ul className="space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  className="w-full mt-3"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading}
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Continuing…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Upgrade to {plan.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TaxProMembershipPlans;
