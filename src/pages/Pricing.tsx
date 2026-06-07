import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle, Star, X, Loader2, ShieldCheck, Tag, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import EarningsCalculator from '@/components/EarningsCalculator';
import { validatePromoCode, type ValidatePromoResult } from '@/services/promoCodeService';
import { type MembershipTier } from '@/services/membershipCheckoutService';
import MembershipPaymentDialog from '@/components/MembershipPaymentDialog';
import SubscriptionBilling from '@/components/pro/SubscriptionBilling';


type TierKey = MembershipTier;

interface Tier {
  key: TierKey;
  name: string;
  tagline: string;
  price: number;
  priceLabel: string;
  compensation: string;
  requirements: string;
  primaryRole: string;
  highlight?: 'popular' | 'vip' | 'bureau';
  benefits: string[];
}

const TIERS: Tier[] = [
  {
    key: 'associate',
    name: 'Associate',
    tagline: 'Entry-level — build your tax career',
    price: 99.95,
    priceLabel: '$99.95',
    compensation: '$100 for each paid tax return',
    requirements: 'PTIN required',
    primaryRole: 'Marketing & client onboarding',
    benefits: [
      'Tax Preparation Certification',
      'Complete Marketing Kit',
      'Professional Tax Software (Retails for $1,495.00)',
      'Data collection & basic tax prep under supervision',
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    tagline: 'For experienced preparers ready to grow',
    price: 299.95,
    priceLabel: '$299.95',
    compensation: '$240 – $1,200 for each paid tax return. Appx 80%',
    requirements: '1+ years of tax preparation experience, PTIN required',
    primaryRole: 'Marketing & preparing tax returns',
    highlight: 'popular',
    benefits: [
      'Tax Preparation Certification',
      'Earn 18 CPE Credits and become IRS AFSP Accredited',
      'Complete Marketing Kit',
      'Professional Tax Software (Retails for $1,495.00)',
    ],
  },
  {
    key: 'premier',
    name: 'Premier Partner',
    tagline: 'For elite preparers with proven success',
    price: 499.95,
    priceLabel: '$499.95',
    compensation: 'Keep 100% of your tax preparation fees',
    requirements: '2+ years of tax preparation experience, EFIN required',
    primaryRole: 'Marketing & preparing tax returns',
    highlight: 'vip',
    benefits: [
      'Tax Preparation Certification',
      'Build your team by having other tax preparers work under your office',
      'Earn 18 CPE Credits and become IRS AFSP Accredited',
      'Complete Marketing Kit',
      'Professional Tax Software (Retails for $1,495.00)',
    ],
  },
  {
    key: 'service_bureau',
    name: 'Service Bureau Partner',
    tagline: 'Run a multi-preparer office or franchise',
    price: 1499.95,
    priceLabel: '$1,499.95',
    compensation: 'Override on every return your network files',
    requirements: 'EFIN required, established office',
    primaryRole: 'Operate & grow a preparer network',
    highlight: 'bureau',
    benefits: [
      'Everything in Premier Partner',
      'Preparer-network management — invite & manage sub-preparers',
      'Advanced cross-network earnings & production reporting',
      'Office / franchise admin tools',
      'Priority partner support & dedicated onboarding',
    ],
  },
];

const COMPARISON_FEATURES: {
  label: string;
  associate: string | boolean;
  professional: string | boolean;
  premier: string | boolean;
  service_bureau: string | boolean;
}[] = [
  { label: 'Upgrade Fee', associate: '$99.95', professional: '$299.95', premier: '$499.95', service_bureau: '$1,499.95' },
  { label: 'Per-Return Compensation', associate: '$100 flat', professional: '$240 – $1,200', premier: '100% of fees', service_bureau: '100% + network override' },
  { label: 'Approx. Revenue Share', associate: 'Flat fee', professional: '~80%', premier: '100%', service_bureau: '100% + override' },
  { label: 'PTIN Required', associate: true, professional: true, premier: true, service_bureau: true },
  { label: 'EFIN Required', associate: false, professional: false, premier: true, service_bureau: true },
  { label: 'Experience Required', associate: 'None', professional: '1+ years', premier: '2+ years', service_bureau: 'Established office' },
  { label: 'Tax Preparation Certification', associate: true, professional: true, premier: true, service_bureau: true },
  { label: 'Complete Marketing Kit', associate: true, professional: true, premier: true, service_bureau: true },
  { label: 'Professional Tax Software (Retails for $1,495.00)', associate: true, professional: true, premier: true, service_bureau: true },
  { label: 'IRS AFSP Accreditation (18 CPE)', associate: false, professional: true, premier: true, service_bureau: true },
  { label: 'Build Your Own Team', associate: false, professional: false, premier: true, service_bureau: true },
  { label: 'Priority Lead Routing', associate: false, professional: true, premier: true, service_bureau: true },
  { label: 'Preparer-Network Management', associate: false, professional: false, premier: false, service_bureau: true },
  { label: 'Advanced Network Reporting', associate: false, professional: false, premier: false, service_bureau: true },
];

const FAQS = [
  { q: 'How does the compensation split actually work?', a: 'Compensation is calculated per paid (funded) tax return. Associates earn a flat $100 per return. Professionals keep approximately 80% of each return, which typically works out to $240–$1,200 per return depending on complexity. Premier Partners keep 100% of their tax preparation fees.' },
  { q: 'When do I get paid?', a: 'Compensation is disbursed after the IRS funds the return and the bank product clears. Most preparers see funds in their account within 24–72 hours of funding during tax season.' },
  { q: 'Is the upgrade fee a one-time charge or recurring?', a: 'The upgrade fee is a one-time annual fee that covers your certification, marketing kit, professional tax software license, and continuing education credits where applicable.' },
  { q: 'Can I upgrade between tiers later?', a: 'Yes. You can upgrade at any time. The difference between your current tier and the new tier will be prorated. Downgrades take effect at the next renewal cycle.' },
  { q: 'What happens if I don\'t have a PTIN or EFIN yet?', a: 'A PTIN is required for all tiers and can be obtained from the IRS in under 15 minutes for free. An EFIN is only required for Premier Partners and takes 4–6 weeks to obtain from the IRS.' },
  { q: 'Do I keep ownership of my client relationships?', a: 'Yes. Every preparer on Refund Connect retains full ownership of their client relationships, contact information, and book of business.' },
  { q: 'Is there a money-back guarantee?', a: 'Yes. We offer a 14-day money-back guarantee on all tier upgrades if you have not yet completed any paid returns through the platform.' },
];

const Pricing: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);
  const [payDialogTier, setPayDialogTier] = useState<TierKey | null>(null);


  // Promo code state (shared across all tier cards)
  const [promoInput, setPromoInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<ValidatePromoResult | null>(null);

  const handleValidatePromo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promoInput.trim()) return;
    setValidating(true);
    setPromoResult(null);
    try {
      const result = await validatePromoCode(promoInput);
      setPromoResult(result);
    } finally {
      setValidating(false);
    }
  };

  const handleClearPromo = () => {
    setPromoInput('');
    setPromoResult(null);
  };

  const handleCheckout = async (tier: Tier) => {
    if (!user || !user.email) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in or create an account to upgrade your membership.',
      });
      navigate('/profile');
      return;
    }

    setLoadingTier(tier.key);

    // CRM notify (non-blocking) — captures upgrade INTENT even if they don't pay.
    try {
      await fetch('https://famous.ai/api/crm/68a3939608e7f1e2bfd480c9/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name || '',
          source: 'pricing-page-checkout',
          tags: [`tier-${tier.key}`, 'upgrade-intent'],
        }),
      });
    } catch (err) {
      console.warn('CRM notify failed (non-fatal):', err);
    }

    // Open the inline Stripe Elements payment dialog. NO redirect — payment
    // happens right here on the page, which is the single biggest conversion
    // fix on the entire site.
    setPayDialogTier(tier.key);
    setLoadingTier(null);
  };


  const renderCheck = (val: string | boolean) => {
    if (typeof val === 'boolean') {
      return val ? (
        <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
      ) : (
        <X className="h-5 w-5 text-gray-300 mx-auto" />
      );
    }
    return <span className="text-sm text-gray-700">{val}</span>;
  };

  const discount = promoResult?.valid ? promoResult.amount ?? 0 : 0;

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <ShieldCheck className="h-4 w-4" />
              Transparent, no-hidden-fees pricing
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Choose the Tier That Fits Your Practice
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Four flexible membership tiers — each designed to help tax professionals at every
              stage earn more, work smarter, and grow into a full service bureau.
            </p>
          </div>

          {/* Promo Code Bar */}
          <div className="max-w-3xl mx-auto mb-10 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white flex-shrink-0">
                <Tag className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Have a promo code?</h4>
                <p className="text-xs text-gray-600">
                  Apply it now and your discount will carry into Stripe Checkout.
                </p>
              </div>
            </div>
            {!promoResult?.valid ? (
              <form onSubmit={handleValidatePromo} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Enter promo code (e.g. SAVE50-XXXXXX)"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  aria-label="Promo code"
                />
                <Button
                  type="submit"
                  disabled={validating || !promoInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {validating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>
                  ) : ('Apply Code')}
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-3 bg-white border border-green-200 rounded-lg p-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-gray-900">{promoResult.code}</div>
                  <div className="text-sm text-green-700 font-medium">
                    ${promoResult.amount} discount will be applied at checkout
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearPromo}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Remove
                </button>
              </div>
            )}
            {promoResult && !promoResult.valid && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{promoResult.message || 'Invalid promo code'}</span>
              </div>
            )}
          </div>

          {/* Tier Cards */}
          <div id="tiers" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {TIERS.map((tier) => {
              const isPopular = tier.highlight === 'popular';
              const isVip = tier.highlight === 'vip';
              const isBureau = tier.highlight === 'bureau';
              const finalPrice = Math.max(0, tier.price - discount);
              return (
                <div
                  key={tier.key}
                  className={`relative bg-white rounded-2xl shadow-lg p-8 flex flex-col transition-transform hover:-translate-y-1 ${
                    isPopular ? 'border-2 border-blue-500 ring-4 ring-blue-100' : ''
                  } ${isVip ? 'border-2' : ''} ${isBureau ? 'border-2 border-emerald-500 ring-4 ring-emerald-50' : ''}`}
                  style={isVip ? { borderColor: '#FFD700' } : undefined}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-sm font-semibold px-4 py-1 rounded-full shadow">
                        Most Popular
                      </span>
                    </div>
                  )}
                  {isVip && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-sm font-semibold px-4 py-1 rounded-full shadow flex items-center gap-1">
                        <Star className="h-4 w-4 fill-current" />
                        VIP
                      </span>
                    </div>
                  )}
                  {isBureau && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold px-4 py-1 rounded-full shadow whitespace-nowrap">
                        Enterprise
                      </span>
                    </div>
                  )}

                  <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                  <p className="text-gray-500 mt-1 mb-6">{tier.tagline}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      {discount > 0 ? (
                        <span className="text-4xl font-bold text-gray-900">
                          ${finalPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-4xl font-bold text-gray-900">{tier.priceLabel}</span>
                      )}
                    </div>

                    {discount > 0 ? (
                      <p className="text-sm text-green-700 font-medium mt-1">
                        <s className="text-gray-400 mr-1">{tier.priceLabel}</s>
                        Save ${discount.toFixed(2)} with {promoResult?.code}
                      </p>
                    ) : (
                      <p className="text-sm text-green-700 font-medium mt-1">
                        One-time annual upgrade
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 mb-6 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Compensation</p>
                      <p className="text-gray-900 font-medium">{tier.compensation}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Primary Role</p>
                      <p className="text-gray-700">{tier.primaryRole}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Requirements</p>
                      <p className="text-gray-700">{tier.requirements}</p>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-8 flex-grow">
                    {tier.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{b}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleCheckout(tier)}
                    disabled={loadingTier === tier.key}
                    className={`w-full text-base py-6 ${
                      isPopular
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : isVip
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700'
                        : isBureau
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                        : ''
                    }`}
                  >
                    {loadingTier === tier.key ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening secure payment…</>
                    ) : (
                      <>Upgrade to {tier.name} — ${finalPrice.toFixed(2)}</>
                    )}
                  </Button>
                  <p className="text-xs text-center text-gray-500 mt-3">
                    Secure card payment powered by Stripe — no redirect
                  </p>
                </div>
              );
            })}
          </div>


          {/* Prefer automatic renewal? — recurring subscription path (Phase 4) */}
          {user && (
            <div className="max-w-3xl mx-auto mb-16">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Prefer automatic renewal?</h2>
                <p className="text-gray-600 mt-1">
                  Subscribe and your membership renews each year automatically — manage or cancel
                  anytime from the Stripe customer portal.
                </p>
              </div>
              <SubscriptionBilling />
            </div>
          )}

          {/* Earnings Calculator */}
          <EarningsCalculator />

          {/* Comparison Table */}
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-10 mb-16 overflow-x-auto">
            <h2 className="text-3xl font-bold text-center mb-2">Compare All Features</h2>
            <p className="text-center text-gray-600 mb-8">
              See exactly what's included with each tier
            </p>
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 text-gray-700 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 text-gray-900 font-bold">Associate</th>
                  <th className="text-center py-4 px-4 text-blue-600 font-bold">
                    Professional
                    <span className="block text-xs text-blue-500 font-normal">Most Popular</span>
                  </th>
                  <th className="text-center py-4 px-4 font-bold" style={{ color: '#B8860B' }}>
                    Premier Partner
                    <span className="block text-xs font-normal" style={{ color: '#B8860B' }}>VIP</span>
                  </th>
                  <th className="text-center py-4 px-4 font-bold text-emerald-700">
                    Service Bureau
                    <span className="block text-xs font-normal text-emerald-600">Enterprise</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-3 px-4 text-gray-800 font-medium">{row.label}</td>
                    <td className="py-3 px-4 text-center">{renderCheck(row.associate)}</td>
                    <td className="py-3 px-4 text-center">{renderCheck(row.professional)}</td>
                    <td className="py-3 px-4 text-center">{renderCheck(row.premier)}</td>
                    <td className="py-3 px-4 text-center">{renderCheck(row.service_bureau)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-center mb-2">Compensation & Pricing FAQs</h2>
            <p className="text-center text-gray-600 mb-8">
              Everything you need to know about how you get paid
            </p>
            <Accordion type="single" collapsible className="bg-white rounded-2xl shadow-lg p-6">
              {FAQS.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left font-semibold text-gray-900">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-700 leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-10 text-center text-white">
            <h2 className="text-3xl font-bold mb-3">Still have questions?</h2>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Talk with our team and we'll help you choose the right tier for your goals and
              experience level.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/support')} variant="secondary" className="text-base">
                Contact Support
              </Button>
              <Button
                onClick={() => navigate('/join-platform')}
                className="bg-white text-blue-700 hover:bg-blue-50 text-base"
              >
                Start Free Application
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Stripe Elements payment dialog — THE fix for "0 sales in 40 days" */}
      {payDialogTier && user && user.email && (
        <MembershipPaymentDialog
          open={!!payDialogTier}
          onClose={() => setPayDialogTier(null)}
          tier={payDialogTier}
          userId={user.id}
          userEmail={user.email}
          userName={user.name}
          promoCode={promoResult?.valid ? promoResult.code : undefined}
          promoAmount={promoResult?.valid ? promoResult.amount : undefined}
          promoDocId={promoResult?.valid ? promoResult.docId : undefined}
          onSuccess={() => {
            toast({
              title: 'Membership activated',
              description: 'Your new tier is live. Refresh to see all features.',
            });
          }}
        />
      )}
    </AppLayout>
  );
};

export default Pricing;
