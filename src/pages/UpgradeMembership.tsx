import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Star,
  CheckCircle,
  Tag,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  validatePromoCode,
  type ValidatePromoResult,
} from '@/services/promoCodeService';

const TIERS = [
  { id: 'associate', name: 'Associate', price: 99.95 },
  { id: 'professional', name: 'Professional', price: 299.95 },
  { id: 'premier', name: 'Premier Partner', price: 499.95 },
] as const;

type TierId = (typeof TIERS)[number]['id'];

const UpgradeMembership: React.FC = () => {
  const navigate = useNavigate();

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<ValidatePromoResult | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TierId>('professional');

  const handleValidate = async (e?: React.FormEvent) => {
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
    setPromoResult(null);
    setPromoInput('');
  };

  const handleCopyCode = async () => {
    if (!promoResult?.code) return;
    try {
      await navigator.clipboard.writeText(promoResult.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const tier = TIERS.find((t) => t.id === selectedTier)!;
  const discount = promoResult?.valid ? promoResult.amount ?? 0 : 0;
  const total = Math.max(0, tier.price - discount);

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/member-portal')}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-3xl">Upgrade Your Membership</CardTitle>
              <CardDescription>
                Choose a membership tier and complete the application to unlock
                additional benefits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Acquisition Package */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('associate')}
                  className={`text-left border rounded-lg p-6 hover:shadow-lg transition-all ${
                    selectedTier === 'associate'
                      ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/30'
                      : 'border-gray-200'
                  }`}
                >
                  <h3 className="text-xl font-bold mb-2">Associate</h3>
                  <div className="text-2xl font-bold text-green-600 mb-4">
                    $99.95
                  </div>
                  <ul className="space-y-2 text-sm mb-4">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Entry Level - PTIN required</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>$100 per paid return</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Complete Marketing Kit</span>
                    </li>
                  </ul>
                </button>

                {/* Professional Package */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('professional')}
                  className={`text-left border-2 rounded-lg p-6 hover:shadow-lg transition-all relative ${
                    selectedTier === 'professional'
                      ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/30'
                      : 'border-blue-500'
                  }`}
                >
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                    Popular
                  </div>
                  <h3 className="text-xl font-bold mb-2">Professional</h3>
                  <div className="text-2xl font-bold text-green-600 mb-4">
                    $299.95
                  </div>
                  <ul className="space-y-2 text-sm mb-4">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>1+ years experience</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>$240-$1,200 per return (~80%)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>18 CPE Credits + AFSP</span>
                    </li>
                  </ul>
                </button>

                {/* Premier Partner */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('premier')}
                  className={`text-left border-2 rounded-lg p-6 hover:shadow-lg transition-all relative ${
                    selectedTier === 'premier'
                      ? 'ring-2 ring-yellow-200 bg-yellow-50/30'
                      : ''
                  }`}
                  style={{ borderColor: '#FFD700' }}
                >
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-xs flex items-center">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    VIP
                  </div>
                  <h3 className="text-xl font-bold mb-2">Premier Partner</h3>
                  <div className="text-2xl font-bold text-green-600 mb-4">
                    $499.95
                  </div>
                  <ul className="space-y-2 text-sm mb-4">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>2+ years experience, EFIN</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Keep 100% of fees</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Build your own team</span>
                    </li>
                  </ul>
                </button>
              </div>

              {/* Promo Code Section */}
              <div className="mb-8 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white flex-shrink-0">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Have a promo code?
                    </h4>
                    <p className="text-xs text-gray-600">
                      Enter your code to apply your discount to this tier
                      upgrade.
                    </p>
                  </div>
                </div>

                {!promoResult?.valid ? (
                  <form
                    onSubmit={handleValidate}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) =>
                        setPromoInput(e.target.value.toUpperCase())
                      }
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
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Checking…
                        </>
                      ) : (
                        'Apply Code'
                      )}
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-start gap-3 bg-white border border-green-200 rounded-lg p-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-900">
                          {promoResult.code}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-blue-900"
                          aria-label="Copy code"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-green-700 font-medium">
                        ${promoResult.amount} discount applied
                      </p>
                      {promoResult.expiresAt && (
                        <p className="text-[11px] text-gray-500">
                          Valid until{' '}
                          {promoResult.expiresAt.toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPromo}
                      className="text-xs text-gray-500 hover:text-gray-700"
                      aria-label="Remove promo code"
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

                {/* Live total preview */}
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-white/80 rounded-lg p-3 border border-gray-200">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500">
                      Selected tier
                    </div>
                    <div className="font-semibold text-gray-900 mt-0.5">
                      {tier.name}
                    </div>
                    <div className="text-gray-600">${tier.price.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 border border-gray-200">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500">
                      Discount
                    </div>
                    <div
                      className={`font-semibold mt-0.5 ${
                        discount > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {discount > 0 ? `-$${discount.toFixed(2)}` : '$0.00'}
                    </div>
                    <div className="text-gray-600">
                      {discount > 0 ? promoResult?.code : 'No code'}
                    </div>
                  </div>
                  <div className="bg-blue-600 text-white rounded-lg p-3">
                    <div className="text-[11px] uppercase tracking-wider text-blue-100">
                      Total today
                    </div>
                    <div className="font-bold text-lg mt-0.5">
                      ${total.toFixed(2)}
                    </div>
                    {discount > 0 && (
                      <div className="text-[11px] text-blue-100">
                        You save ${discount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                {promoResult?.valid && (
                  <div className="mt-3 text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <strong>Important:</strong> Enter the code{' '}
                    <span className="font-mono font-semibold">
                      {promoResult.code}
                    </span>{' '}
                    in the &quot;Promo Code&quot; field of the application form
                    below so we can apply your ${promoResult.amount} discount on
                    checkout.
                  </div>
                )}
              </div>

              {/* Application Form */}
              <div className="w-full h-[700px] border rounded-lg overflow-hidden bg-white">
                <iframe
                  src="https://pci.jotform.com/form/252927299861170"
                  title="Membership Upgrade Application"
                  className="w-full h-full"
                  frameBorder="0"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default UpgradeMembership;
