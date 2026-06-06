import React from 'react';
import AppLayout from '@/components/AppLayout';
import MemberBenefits from '@/components/MemberBenefits';
import EarningsCalculator from '@/components/EarningsCalculator';
import ExitIntentPopup from '@/components/ExitIntentPopup';
import { CheckCircle, Star, X, ShieldCheck, TrendingUp, Users, Award, Zap } from 'lucide-react';
import { useLandingAnalytics } from '@/hooks/useLandingAnalytics';
import { trackCtaClick, trackTierInterest } from '@/services/landingAnalyticsService';

const COMPARISON_FEATURES: {
  label: string;
  associate: string | boolean;
  professional: string | boolean;
  premier: string | boolean;
}[] = [
  { label: 'Upgrade Fee', associate: '$99.95', professional: '$299.95', premier: '$499.95' },
  { label: 'Per-Return Compensation', associate: '$100 flat', professional: '$240 – $1,200', premier: '100% of fees' },
  { label: 'Approx. Revenue Share', associate: 'Flat fee', professional: '~80%', premier: '100%' },
  { label: 'PTIN Required', associate: true, professional: true, premier: true },
  { label: 'EFIN Required', associate: false, professional: false, premier: true },
  { label: 'Experience Required', associate: 'None', professional: '1+ years', premier: '2+ years' },
  { label: 'Tax Preparation Certification', associate: true, professional: true, premier: true },
  { label: 'Complete Marketing Kit', associate: true, professional: true, premier: true },
  { label: 'Professional Tax Software (Retails for $1,495.00)', associate: true, professional: true, premier: true },
  { label: 'IRS AFSP Accreditation (18 CPE)', associate: false, professional: true, premier: true },
  { label: 'Build Your Own Team', associate: false, professional: false, premier: true },
  { label: 'Priority Lead Routing', associate: false, professional: true, premier: true },
];

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

const PAGE_KEY = '/join-platform';

const scrollToTiers = () => {
  const el = document.getElementById('membership-tiers');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const scrollToCalculator = () => {
  const el = document.getElementById('earnings-calculator');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const JoinPlatform: React.FC = () => {
  // A/B variant assignment (sticky per visitor)
  const variant = React.useMemo(() => {
    if (typeof window === 'undefined') return 'A';
    let v = localStorage.getItem('rc_landing_variant');
    if (!v) {
      v = Math.random() < 0.5 ? 'A' : 'B';
      localStorage.setItem('rc_landing_variant', v);
    }
    return v;
  }, []);

  useLandingAnalytics(PAGE_KEY, variant);

  const handleRegister = (ctaId: string) => {
    trackCtaClick(PAGE_KEY, ctaId, variant);
  };

  const handleViewTiers = () => {
    trackCtaClick(PAGE_KEY, 'view_tiers', variant);
    scrollToTiers();
  };

  const handleCalculate = () => {
    trackCtaClick(PAGE_KEY, 'calculate_earnings', variant);
    scrollToCalculator();
  };

  const handleTierClick = (tier: 'associate' | 'professional' | 'premier') => {
    trackTierInterest(PAGE_KEY, tier);
  };

  return (
    <AppLayout>

      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white py-20">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-blue-100 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <ShieldCheck className="h-4 w-4" />
              Trusted by tax professionals nationwide
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold mb-4 leading-tight">
              Start &amp; Grow Your Tax Business.
              <span className="block bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                Earn More. Work Smarter.
              </span>
            </h1>
            <h2 className="text-xl sm:text-2xl font-semibold text-blue-200 mb-4">TAX PRO LISTING</h2>
            <p className="text-lg sm:text-xl text-blue-100 max-w-3xl mx-auto mb-8">
              Join thousands of tax professionals using our platform to showcase their profile,
              connect with qualified clients, and scale their business — starting <strong className="text-white">100% FREE</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10 flex-wrap">
              <a
                href="https://refund-connect.com/onboarding"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleRegister('register_hero')}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 px-8 py-4 text-lg rounded-xl font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-105"
              >
                Register Today For FREE
              </a>
              <button
                onClick={handleViewTiers}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-8 py-4 text-lg rounded-xl font-semibold transition-all"
              >
                View Membership Tiers
              </button>
              <button
                onClick={handleCalculate}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-8 py-4 text-lg rounded-xl font-semibold transition-all"
              >
                <TrendingUp className="h-5 w-5" />
                Calculate Earnings
              </button>
            </div>


            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-8 border-t border-white/10">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-300">$1,200</div>
                <div className="text-sm text-blue-200">Per return potential</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-300">100%</div>
                <div className="text-sm text-blue-200">Keep your fees (Premier)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-300">18</div>
                <div className="text-sm text-blue-200">CPE Credits included</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-300">FREE</div>
                <div className="text-sm text-blue-200">To get started</div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* What's Included */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-16 max-w-3xl mx-auto border border-gray-100">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
                <CheckCircle className="h-4 w-4" />
                Free Membership Includes
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Everything You Need to Start</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Professional profile listing in our directory',
                'Access to qualified client leads',
                'Secure client communication tools',
                'Flexible appointment scheduling system',
                'Annual marketing and business success tools',
                'Dedicated onboarding support',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <div className="text-3xl font-bold text-green-600 mb-3">FREE to Join</div>
              <a
                href="https://refund-connect.com/onboarding"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleRegister('register_inline')}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
              >
                Register Today For FREE
              </a>

              <div className="text-sm text-gray-500 mt-2">
                Activate your free listing & tools. No credit card required.
              </div>
            </div>
          </div>

          {/* Membership Tiers */}
          <div id="membership-tiers" className="mb-16">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Membership Upgrade Options</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                After joining our free network, unlock more earning potential with one of these professional levels:
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div onClick={() => handleTierClick('associate')} className="bg-white rounded-2xl shadow-md p-8 transition-transform hover:-translate-y-1 cursor-pointer">

                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">Associate</h3>
                  <p className="text-gray-600 text-sm">Entry-level — build your tax career</p>
                  <div className="text-3xl font-bold text-gray-900 mt-4">$99.95</div>

                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Primary role:</strong> Marketing & client onboarding</p>
                  <p><strong>Requirements:</strong> PTIN required</p>
                  <p><strong>Compensation:</strong> $100 for each paid tax return</p>
                  <p className="pt-2"><strong>Benefits:</strong></p>
                  <ul className="space-y-1.5">
                    {['Tax Preparation Certification', 'Complete Marketing Kit', 'Professional Tax Software (Retails for $1,495.00)'].map(b => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t text-center">
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm">
                    Available after free membership
                  </div>
                </div>
              </div>

              <div onClick={() => handleTierClick('professional')} className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-500 ring-4 ring-blue-100 relative transition-transform hover:-translate-y-1 cursor-pointer">

                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow">Most Popular</div>
                </div>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">Professional</h3>
                  <p className="text-gray-600 text-sm">For experienced preparers ready to grow</p>
                  <div className="text-3xl font-bold text-gray-900 mt-4">$299.95</div>

                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Primary role:</strong> Marketing & preparing tax returns</p>
                  <p><strong>Requirements:</strong> 1+ years experience, PTIN required</p>
                  <p><strong>Compensation:</strong> $240 – $1,200 per return (~80%)</p>
                  <p className="pt-2"><strong>Benefits:</strong></p>
                  <ul className="space-y-1.5">
                    {['Tax Preparation Certification', 'Earn 18 CPE Credits — IRS AFSP Accredited', 'Complete Marketing Kit', 'Professional Tax Software (Retails for $1,495.00)'].map(b => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t text-center">
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm">
                    Available after free membership
                  </div>
                </div>
              </div>

              <div onClick={() => handleTierClick('premier')} className="bg-white rounded-2xl shadow-md p-8 border-2 relative transition-transform hover:-translate-y-1 cursor-pointer" style={{ borderColor: '#FFD700' }}>

                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center shadow">
                    <Star className="h-4 w-4 mr-1 fill-current" />
                    VIP
                  </div>
                </div>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">Premier Partner</h3>
                  <p className="text-gray-600 text-sm">For elite preparers with proven success</p>
                  <div className="text-3xl font-bold text-gray-900 mt-4">$499.95</div>
                </div>

                <div className="space-y-2 text-sm">
                  <p><strong>Primary role:</strong> Marketing & preparing tax returns</p>
                  <p><strong>Requirements:</strong> 2+ years experience, EFIN required</p>
                  <p><strong>Compensation:</strong> Keep 100% of your fees</p>
                  <p className="pt-2"><strong>Benefits:</strong></p>
                  <ul className="space-y-1.5">
                    {['Tax Preparation Certification', 'Build your own team of preparers', 'Earn 18 CPE Credits — IRS AFSP Accredited', 'Complete Marketing Kit', 'Professional Tax Software (Retails for $1,495.00)'].map(b => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t text-center">
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm">
                    Available after free membership
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Member Benefits Section */}
          <MemberBenefits />

          <div id="earnings-calculator" className="mt-16">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
                <TrendingUp className="h-4 w-4" />
                See Your Earning Potential
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Calculate How Much You Can Earn</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Use our interactive calculator to estimate your annual earnings based on your tier and volume.
              </p>
            </div>
            <EarningsCalculator />
          </div>


          {/* Comparison Table */}
          <div className="mt-16 bg-white rounded-2xl shadow-lg p-6 sm:p-10 overflow-x-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
                <Award className="h-4 w-4" />
                Side-by-Side Comparison
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Compare All Features</h2>
              <p className="text-lg text-gray-600">
                See exactly what's included with each tier
              </p>
            </div>
            <table className="w-full min-w-[640px]">
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
                    <span className="block text-xs font-normal" style={{ color: '#B8860B' }}>
                      VIP
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row, i) => (
                  <tr
                    key={row.label}
                    className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                  >
                    <td className="py-3 px-4 text-gray-800 font-medium">{row.label}</td>
                    <td className="py-3 px-4 text-center">{renderCheck(row.associate)}</td>
                    <td className="py-3 px-4 text-center">{renderCheck(row.professional)}</td>
                    <td className="py-3 px-4 text-center">{renderCheck(row.premier)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trust / Social Proof Row */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-md p-6 text-center border border-gray-100">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                <Users className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Active Network</h4>
              <p className="text-sm text-gray-600">Join hundreds of certified tax pros already earning on our platform.</p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-6 text-center border border-gray-100">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                <Zap className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Fast Payouts</h4>
              <p className="text-sm text-gray-600">Get paid within 24–72 hours of IRS funding during tax season.</p>
            </div>
            <div className="bg-white rounded-2xl shadow-md p-6 text-center border border-gray-100">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 mb-3">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Risk-Free</h4>
              <p className="text-sm text-gray-600">Start completely free. 14-day money-back guarantee on all upgrades.</p>
            </div>
          </div>

          {/* Final CTA */}
          <div className="mt-16 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-10 sm:p-14 text-center text-white shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Ready to Grow Your Tax Practice?</h2>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Join free today and start connecting with qualified clients in minutes.
              No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/onboarding"
                onClick={() => handleRegister('register_footer')}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 px-8 py-4 text-lg rounded-xl font-bold transition-all shadow-xl hover:scale-105"
              >
                Start Professional Onboarding — FREE
              </a>
              <button
                onClick={handleViewTiers}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-8 py-4 text-lg rounded-xl font-semibold transition-all"
              >
                Compare Tiers Again
              </button>
            </div>

            <p className="text-blue-200 text-sm mt-6">
              Complete your professional profile and start connecting with clients today.
            </p>
          </div>
        </div>
      </div>

      {/* Exit-Intent Popup with $50 OFF promo */}
      <ExitIntentPopup
        page={PAGE_KEY}
        variant={variant}
        offerHeadline="Get $50 OFF Any Tier Upgrade"
        offerSubtext="Today only — claim your exclusive discount before it expires."
        countdownSeconds={15 * 60}
      />
    </AppLayout>

  );
};

export default JoinPlatform;
