import React, { useEffect, useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, TrendingUp, Sparkles, Award, Mail, Send, CheckCircle2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';


type Complexity = 'simple' | 'standard' | 'complex';

const COMPLEXITY_OPTIONS: {
  key: Complexity;
  label: string;
  fee: number;
  description: string;
}[] = [
  { key: 'simple', label: 'Simple', fee: 300, description: '1040-EZ, W-2 only, standard deduction' },
  { key: 'standard', label: 'Standard', fee: 700, description: 'Itemized, dependents, credits, state' },
  { key: 'complex', label: 'Complex', fee: 1500, description: 'Self-employed, multi-state, K-1, schedules' },
];

// Premier platform cost per return (covers software, e-file, bank product, support)
const PREMIER_PLATFORM_COST_PER_RETURN = 35;

const TIER_FEES = {
  associate: 99.95,
  professional: 299.95,
  premier: 499.95,
};

const formatUSD = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const EarningsCalculator: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [returns, setReturns] = useState<number>(75);
  const [complexity, setComplexity] = useState<Complexity>('standard');

  // Email-me-this-projection modal state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailName, setEmailName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);


  const avgFee = useMemo(
    () => COMPLEXITY_OPTIONS.find((o) => o.key === complexity)?.fee ?? 700,
    [complexity]
  );

  const calculations = useMemo(() => {
    // Associate: flat $100 / return - upgrade fee
    const associateGross = returns * 100;
    const associateNet = associateGross - TIER_FEES.associate;

    // Professional: ~80% of fee - upgrade fee
    const professionalGross = returns * avgFee * 0.8;
    const professionalNet = professionalGross - TIER_FEES.professional;

    // Premier: 100% of fee - platform cost per return - upgrade fee
    const premierGross = returns * avgFee - returns * PREMIER_PLATFORM_COST_PER_RETURN;
    const premierNet = premierGross - TIER_FEES.premier;

    return {
      associate: { gross: associateGross, net: associateNet },
      professional: { gross: professionalGross, net: professionalNet },
      premier: { gross: premierGross, net: premierNet },
    };
  }, [returns, avgFee]);

  const recommendedTier = useMemo(() => {
    const tiers = [
      { key: 'associate', name: 'Associate', net: calculations.associate.net },
      { key: 'professional', name: 'Professional', net: calculations.professional.net },
      { key: 'premier', name: 'Premier Partner', net: calculations.premier.net },
    ];
    return tiers.reduce((max, t) => (t.net > max.net ? t : max), tiers[0]);
  }, [calculations]);

  const chartData = [
    {
      tier: 'Associate',
      net: Math.max(0, Math.round(calculations.associate.net)),
      fill: '#9CA3AF',
    },
    {
      tier: 'Professional',
      net: Math.max(0, Math.round(calculations.professional.net)),
      fill: '#3B82F6',
    },
    {
      tier: 'Premier',
      net: Math.max(0, Math.round(calculations.premier.net)),
      fill: '#D4A017',
    },
  ];

  const tierColors: Record<string, { bg: string; border: string; text: string }> = {
    associate: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' },
    professional: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' },
    premier: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-800' },
  };

  // Prefill name/email from authenticated user when modal opens
  useEffect(() => {
    if (emailDialogOpen && user) {
      setEmailName((prev) => prev || user.name || '');
      setEmailAddress((prev) => prev || user.email || '');
    }
  }, [emailDialogOpen, user]);

  const projectedNet = Math.max(0, Math.round(recommendedTier.net));
  const totalClientFees = Math.round(returns * avgFee);

  const handleEmailProjection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailSubmitting) return;

    const trimmedEmail = emailAddress.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
    if (!emailValid) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setEmailSubmitting(true);
    try {
      const payload = {
        email: trimmedEmail,
        name: emailName.trim() || undefined,
        source: 'pricing-earnings-calculator',
        tags: [
          'earnings-calculator',
          'projection-request',
          `complexity-${complexity}`,
          `recommended-${recommendedTier.key}`,
        ],
        custom_fields: {
          returns_per_season: returns,
          complexity_level: complexity,
          average_return_fee: avgFee,
          total_client_fees: totalClientFees,
          recommended_tier: recommendedTier.name,
          recommended_tier_key: recommendedTier.key,
          projected_net_earnings: projectedNet,
          associate_net: Math.max(0, Math.round(calculations.associate.net)),
          professional_net: Math.max(0, Math.round(calculations.professional.net)),
          premier_net: Math.max(0, Math.round(calculations.premier.net)),
        },
      };

      const res = await fetch(
        'https://famous.ai/api/crm/68a3939608e7f1e2bfd480c9/subscribe',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        // Still treat as soft-success for the user; log details for debugging.
        console.warn('CRM subscribe responded non-OK:', res.status, await res.text());
      }

      setEmailSubmitted(true);
      toast({
        title: 'Projection sent!',
        description: `We've emailed your personalized earnings projection to ${trimmedEmail}.`,
      });
    } catch (err) {
      console.error('Email projection submission error:', err);
      toast({
        title: 'Something went wrong',
        description: 'We could not send your projection. Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setEmailSubmitting(false);
    }
  };

  const closeEmailDialog = () => {
    setEmailDialogOpen(false);
    // Reset success state after the dialog closes so it's fresh next time.
    setTimeout(() => setEmailSubmitted(false), 300);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-10 mb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
          <Calculator className="h-4 w-4" />
          Earnings Calculator
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          Project Your Annual Earnings
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Enter your expected volume and average return complexity to see what you'd earn at each
          tier this season.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Inputs */}
        <div className="space-y-6 bg-gray-50 rounded-xl p-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="returns-input" className="text-base font-semibold text-gray-900">
                Paid tax returns per season
              </Label>
              <Input
                id="returns-input"
                type="number"
                min={1}
                max={1000}
                value={returns}
                onChange={(e) => {
                  const v = parseInt(e.target.value || '0', 10);
                  if (!isNaN(v)) setReturns(Math.max(1, Math.min(1000, v)));
                }}
                className="w-24 text-right font-bold text-lg"
              />
            </div>
            <Slider
              value={[returns]}
              min={1}
              max={500}
              step={1}
              onValueChange={(v) => setReturns(v[0])}
              className="mt-3"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>1</span>
              <span>250</span>
              <span>500+</span>
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold text-gray-900 mb-3 block">
              Average return complexity
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {COMPLEXITY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setComplexity(opt.key)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    complexity === opt.key
                      ? 'border-blue-500 bg-blue-50 shadow'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm text-gray-900">{opt.label}</div>
                  <div className="text-lg font-bold text-blue-600">{formatUSD(opt.fee)}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-tight">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Your projected season volume:</p>
            <p className="text-2xl font-bold text-gray-900">
              {returns} returns × {formatUSD(avgFee)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Total client fees collected: <span className="font-semibold text-gray-700">
                {formatUSD(returns * avgFee)}
              </span>
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Net Annual Earnings by Tier
          </h3>
          <p className="text-sm text-gray-500 mb-4">After upgrade fee & platform costs</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="tier" tick={{ fontSize: 12, fill: '#4B5563' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#4B5563' }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatUSD(value)}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="net" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="net"
                    position="top"
                    formatter={(v: number) => formatUSD(v)}
                    style={{ fontSize: 12, fontWeight: 600, fill: '#111827' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tier breakdown cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          {
            key: 'associate',
            name: 'Associate',
            data: calculations.associate,
            formula: `${returns} × $100 − $${TIER_FEES.associate}`,
          },
          {
            key: 'professional',
            name: 'Professional',
            data: calculations.professional,
            formula: `${returns} × ${formatUSD(avgFee)} × 80% − $${TIER_FEES.professional}`,
          },
          {
            key: 'premier',
            name: 'Premier Partner',
            data: calculations.premier,
            formula: `${returns} × (${formatUSD(avgFee)} − $${PREMIER_PLATFORM_COST_PER_RETURN}) − $${TIER_FEES.premier}`,
          },
        ].map((t) => {
          const isRec = recommendedTier.key === t.key;
          const c = tierColors[t.key];
          return (
            <div
              key={t.key}
              className={`relative rounded-xl p-5 border-2 ${c.bg} ${
                isRec ? 'border-green-500 ring-4 ring-green-100' : c.border
              }`}
            >
              {isRec && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    BEST
                  </span>
                </div>
              )}
              <p className={`text-sm font-semibold uppercase tracking-wide ${c.text}`}>{t.name}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatUSD(Math.max(0, t.data.net))}
              </p>
              <p className="text-xs text-gray-500 mt-1">Net annual earnings</p>
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                <p className="font-mono leading-relaxed">{t.formula}</p>
                <p className="mt-2">
                  Gross:{' '}
                  <span className="font-semibold text-gray-800">{formatUSD(t.data.gross)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommended Tier Callout */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 sm:p-8 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="bg-white/20 backdrop-blur rounded-full p-4 flex-shrink-0">
            <Award className="h-8 w-8" />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-medium text-green-50 uppercase tracking-wide">
              Recommended for you
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold mt-1">
              {recommendedTier.name} maximizes your earnings
            </h3>
            <p className="text-green-50 mt-2">
              Based on {returns} {complexity} returns/year, you'd net{' '}
              <span className="font-bold text-white">
                {formatUSD(Math.max(0, recommendedTier.net))}
              </span>{' '}
              annually — the highest of all three tiers for your inputs.
            </p>
          </div>
          <a
            href="#tiers"
            className="bg-white text-green-700 hover:bg-green-50 font-semibold px-6 py-3 rounded-lg whitespace-nowrap transition-colors"
          >
            View {recommendedTier.name}
          </a>
        </div>
      </div>

      {/* Email me this projection */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setEmailDialogOpen(true)}
          className="border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800"
        >
          <Mail className="h-4 w-4 mr-2" />
          Email me this projection
        </Button>
        <span className="text-xs text-gray-500">
          Get a copy of your personalized earnings breakdown.
        </span>
      </div>

      <p className="text-xs text-gray-500 text-center mt-6 max-w-3xl mx-auto">
        * Projections are estimates based on the inputs above. Actual earnings vary based on
        completed/funded returns, refund timing, state regulations, and individual practice
        factors. Premier Partner figures include an estimated{' '}
        {formatUSD(PREMIER_PLATFORM_COST_PER_RETURN)}/return platform & e-file cost.
      </p>

      {/* Email Projection Modal */}
      <Dialog
        open={emailDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeEmailDialog();
          else setEmailDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-600" />
              Email me this projection
            </DialogTitle>
            <DialogDescription>
              We'll send your personalized earnings breakdown straight to your inbox.
            </DialogDescription>
          </DialogHeader>

          {emailSubmitted ? (
            <div className="py-4">
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-900">
                  <p className="font-semibold">Projection sent!</p>
                  <p className="mt-1">
                    Check your inbox at <span className="font-semibold">{emailAddress}</span>.
                    You should receive your personalized earnings breakdown within a few minutes.
                  </p>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={closeEmailDialog} className="w-full">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleEmailProjection} className="space-y-4">
              {/* Projection summary preview */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-semibold text-gray-900 mb-1">Your projection summary</p>
                <ul className="space-y-1 text-gray-700">
                  <li className="flex justify-between">
                    <span>Returns / season:</span>
                    <span className="font-medium">{returns}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Complexity:</span>
                    <span className="font-medium capitalize">{complexity} ({formatUSD(avgFee)})</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Recommended tier:</span>
                    <span className="font-medium text-green-700">{recommendedTier.name}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Projected net earnings:</span>
                    <span className="font-bold text-gray-900">{formatUSD(projectedNet)}</span>
                  </li>
                </ul>
              </div>

              <div>
                <Label htmlFor="proj-name">Your name (optional)</Label>
                <Input
                  id="proj-name"
                  value={emailName}
                  onChange={(e) => setEmailName(e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>

              <div>
                <Label htmlFor="proj-email">Email address *</Label>
                <Input
                  id="proj-email"
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <p className="text-xs text-gray-500">
                By submitting, you agree to receive your projection plus occasional updates from
                NATP. You can unsubscribe at any time.
              </p>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEmailDialog}
                  disabled={emailSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={emailSubmitting}>
                  {emailSubmitting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send projection
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EarningsCalculator;

