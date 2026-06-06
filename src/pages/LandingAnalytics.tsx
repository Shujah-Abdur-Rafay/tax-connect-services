import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  fetchLandingAnalytics,
  AggregatedAnalytics,
} from '@/services/landingAnalyticsService';
import {
  BarChart3,
  Users,
  MousePointerClick,
  Eye,
  TrendingUp,
  Clock,
  RefreshCw,
  Target,
  Award,
} from 'lucide-react';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 14 days', value: 14 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

const CTA_LABELS: Record<string, string> = {
  register_hero: 'Register (Hero)',
  register_inline: 'Register (Inline)',
  register_footer: 'Register (Footer)',
  view_tiers: 'View Tiers',
  calculate_earnings: 'Calculate Earnings',
};

const TIER_COLORS: Record<string, string> = {
  associate: 'bg-gray-500',
  professional: 'bg-blue-600',
  premier: 'bg-yellow-500',
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: string;
}> = ({ title, value, subtitle, icon, accent = 'bg-blue-50 text-blue-600' }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm text-gray-500 font-medium">{title}</div>
        <div className="text-3xl font-bold text-gray-900 mt-1">{value}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
        {icon}
      </div>
    </div>
  </div>
);

const ProgressBar: React.FC<{ value: number; max: number; color?: string }> = ({
  value,
  max,
  color = 'bg-blue-600',
}) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const LandingAnalytics: React.FC = () => {
  const [data, setData] = useState<AggregatedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const load = async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLandingAnalytics('/join-platform', days);
      setData(result);
    } catch (err) {
      console.error(err);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(daysBack);
  }, [daysBack]);

  const totalCtas = data
    ? Object.values(data.ctaClicks).reduce((a, b) => a + b, 0)
    : 0;
  const totalTier = data
    ? Object.values(data.tierInterest).reduce((a, b) => a + b, 0)
    : 0;
  const maxScrollBucket = data
    ? Math.max(...Object.values(data.scrollBuckets), 1)
    : 1;

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-2">
                <BarChart3 className="h-3.5 w-3.5" />
                Campaign Analytics
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Join as Professional — Landing Analytics
              </h1>
              <p className="text-gray-600 mt-1">
                Track conversions, CTA performance, and tier interest for{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/join-platform</code>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="/admin/crm-contacts"
                className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Users className="h-4 w-4" />
                CRM Contacts
              </a>
              <select
                value={daysBack}
                onChange={(e) => setDaysBack(parseInt(e.target.value, 10))}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => load(daysBack)}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>


          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="bg-white rounded-xl p-12 text-center text-gray-500">
              Loading analytics...
            </div>
          )}

          {data && (
            <>
              {/* Top stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  title="Page Views"
                  value={data.pageViews.toLocaleString()}
                  subtitle={`${data.uniqueVisitors.toLocaleString()} unique visitors`}
                  icon={<Eye className="h-5 w-5" />}
                  accent="bg-blue-50 text-blue-600"
                />
                <StatCard
                  title="Unique Sessions"
                  value={data.uniqueSessions.toLocaleString()}
                  subtitle="Distinct visit sessions"
                  icon={<Users className="h-5 w-5" />}
                  accent="bg-purple-50 text-purple-600"
                />
                <StatCard
                  title="CTA Clicks"
                  value={totalCtas.toLocaleString()}
                  subtitle={`${data.uniqueVisitors > 0 ? ((totalCtas / data.uniqueVisitors) * 100).toFixed(1) : 0}% per visitor`}
                  icon={<MousePointerClick className="h-5 w-5" />}
                  accent="bg-green-50 text-green-600"
                />
                <StatCard
                  title="Conversion Rate"
                  value={`${data.conversionRate}%`}
                  subtitle="Register clicks / page views"
                  icon={<Target className="h-5 w-5" />}
                  accent="bg-yellow-50 text-yellow-600"
                />
              </div>

              {/* Secondary stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard
                  title="Avg Time on Page"
                  value={`${data.avgTimeOnPage}s`}
                  subtitle="Average across all sessions"
                  icon={<Clock className="h-5 w-5" />}
                  accent="bg-indigo-50 text-indigo-600"
                />
                <StatCard
                  title="Total Tier Interest"
                  value={totalTier.toLocaleString()}
                  subtitle="Tier card interactions"
                  icon={<Award className="h-5 w-5" />}
                  accent="bg-pink-50 text-pink-600"
                />
                <StatCard
                  title="Total Events"
                  value={data.totalEvents.toLocaleString()}
                  subtitle="All tracked events in range"
                  icon={<TrendingUp className="h-5 w-5" />}
                  accent="bg-teal-50 text-teal-600"
                />
              </div>

              {/* Conversion Funnel */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Conversion Funnel</h2>
                <p className="text-sm text-gray-500 mb-6">Sessions that completed each step</p>
                <div className="space-y-4">
                  {[
                    { label: '1. Page viewed', value: data.funnel.viewed, color: 'bg-blue-500' },
                    { label: '2. Scrolled 50%+', value: data.funnel.scrolled50, color: 'bg-indigo-500' },
                    { label: '3. Clicked View Tiers', value: data.funnel.viewedTiers, color: 'bg-purple-500' },
                    { label: '4. Clicked Register', value: data.funnel.clickedRegister, color: 'bg-green-600' },
                  ].map((step, i, arr) => {
                    const max = arr[0].value || 1;
                    const pct = max > 0 ? ((step.value / max) * 100).toFixed(1) : '0';
                    return (
                      <div key={step.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{step.label}</span>
                          <span className="text-sm text-gray-600">
                            <strong className="text-gray-900">{step.value.toLocaleString()}</strong>
                            <span className="text-gray-400 ml-2">({pct}%)</span>
                          </span>
                        </div>
                        <ProgressBar value={step.value} max={max} color={step.color} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* CTA breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">CTA Click-Through</h2>
                  <p className="text-sm text-gray-500 mb-5">
                    Which call-to-action buttons are converting best
                  </p>
                  {Object.keys(data.ctaClicks).length === 0 ? (
                    <div className="text-sm text-gray-400 italic py-6 text-center">
                      No CTA clicks recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(data.ctaClicks)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cta, count]) => {
                          const ctr =
                            data.pageViews > 0
                              ? ((count / data.pageViews) * 100).toFixed(2)
                              : '0';
                          return (
                            <div key={cta}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-medium text-gray-700">
                                  {CTA_LABELS[cta] || cta}
                                </span>
                                <span className="text-sm text-gray-600">
                                  <strong className="text-gray-900">{count}</strong>
                                  <span className="text-gray-400 ml-2">({ctr}% CTR)</span>
                                </span>
                              </div>
                              <ProgressBar value={count} max={totalCtas || 1} color="bg-blue-600" />
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Tier interest */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Tier Interest Breakdown</h2>
                  <p className="text-sm text-gray-500 mb-5">Which membership tiers are getting clicks</p>
                  {totalTier === 0 ? (
                    <div className="text-sm text-gray-400 italic py-6 text-center">
                      No tier interactions recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(['premier', 'professional', 'associate'] as const).map((tier) => {
                        const count = data.tierInterest[tier] || 0;
                        const pct = totalTier > 0 ? ((count / totalTier) * 100).toFixed(1) : '0';
                        return (
                          <div key={tier}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {tier === 'premier' ? 'Premier Partner' : tier}
                              </span>
                              <span className="text-sm text-gray-600">
                                <strong className="text-gray-900">{count}</strong>
                                <span className="text-gray-400 ml-2">({pct}%)</span>
                              </span>
                            </div>
                            <ProgressBar
                              value={count}
                              max={totalTier || 1}
                              color={TIER_COLORS[tier]}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Scroll depth */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Scroll Depth Engagement</h2>
                <p className="text-sm text-gray-500 mb-5">How far visitors scroll down the page</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['25', '50', '75', '100'] as const).map((bucket) => {
                    const count = data.scrollBuckets[bucket] || 0;
                    const pct = data.pageViews > 0 ? ((count / data.pageViews) * 100).toFixed(1) : '0';
                    return (
                      <div
                        key={bucket}
                        className="border border-gray-100 rounded-lg p-4 text-center"
                      >
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                          Scrolled {bucket}%+
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{count}</div>
                        <div className="text-xs text-gray-500 mt-1">{pct}% of views</div>
                        <div className="mt-2">
                          <ProgressBar value={count} max={maxScrollBucket} color="bg-indigo-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent events table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Recent Events</h2>
                <p className="text-sm text-gray-500 mb-4">Last 50 tracked events</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase tracking-wide">
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Detail</th>
                        <th className="py-2 pr-4">Variant</th>
                        <th className="py-2 pr-4">Session</th>
                        <th className="py-2 pr-4">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentEvents.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-gray-400 italic">
                            No events yet.
                          </td>
                        </tr>
                      )}
                      {data.recentEvents.map((e, i) => {
                        const ts = e.createdAt
                          ? (e.createdAt as { toDate?: () => Date }).toDate?.()
                          : null;
                        let detail = '';
                        if (e.eventType === 'cta_click') detail = CTA_LABELS[e.ctaId || ''] || e.ctaId || '';
                        else if (e.eventType === 'tier_interest') detail = e.tier || '';
                        else if (e.eventType === 'scroll_depth') detail = `${e.scrollPercent}%`;
                        else if (e.eventType === 'time_on_page') detail = `${e.durationSeconds}s`;
                        else detail = e.page;
                        return (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2.5 pr-4">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                {e.eventType}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-gray-700">{detail}</td>
                            <td className="py-2.5 pr-4 text-gray-500">{e.variant || '—'}</td>
                            <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">
                              {e.sessionId?.slice(0, 12)}…
                            </td>
                            <td className="py-2.5 pr-4 text-gray-500 text-xs">
                              {ts ? ts.toLocaleString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default LandingAnalytics;
