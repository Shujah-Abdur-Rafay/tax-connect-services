import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getReferralStats,
  capturePendingReferralCode,
  REFERRAL_CREDIT_USD,
  type ReferralStats,
} from '@/services/referralService';
import {
  Copy,
  Gift,
  Mail,
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  Share2,
  Sparkles,
  Wallet,
  Lock,
} from 'lucide-react';
import LoginDialog from '@/components/LoginDialog';
import SignUpDialog from '@/components/SignUpDialog';

const Refer: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);

  // If someone lands on /refer with ?ref=CODE, capture it for their (future)
  // signup — handy for "Friend forwards me the page that explains the deal"
  // flows. We don't apply it here directly because the visitor is the
  // *referrer's* own audience, not the referrer themselves.
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) capturePendingReferralCode(ref);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const s = await getReferralStats(user.uid);
      setStats(s);
    } catch (e: any) {
      console.error('[Refer] failed to load stats', e);
      setError(e?.message || 'Could not load your referral stats.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) load();
  }, [user?.uid, load]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied!', description: `${label} copied to clipboard.` });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const shareLink = stats?.link || '';
  const shareText =
    'Get expert tax help from vetted pros on Refund Connect. Use my link for fast, transparent service:';

  const handleShareNative = async () => {
    if (!shareLink) return;
    const data = { title: 'Refund Connect', text: shareText, url: shareLink };
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share(data);
      } catch {
        /* user dismissed */
      }
    } else {
      copy(shareLink, 'Referral link');
    }
  };

  // ── Unauthenticated state ──────────────────────────────────────────────
  if (!isLoading && !user) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 text-white mb-6">
                <Gift className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Earn ${REFERRAL_CREDIT_USD} for every friend you refer
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Share Refund Connect with friends. When they complete their first paid
                tax service, you get a ${REFERRAL_CREDIT_USD} credit toward any service —
                automatically.
              </p>
            </div>

            <Card className="max-w-md mx-auto">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>Sign in to get your referral link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" size="lg" onClick={() => setLoginOpen(true)}>
                  Log In
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => setSignUpOpen(true)}
                >
                  Create Account
                </Button>
                <p className="text-xs text-gray-500 text-center pt-2">
                  Free to join. No credit card required.
                </p>
              </CardContent>
            </Card>

            <HowItWorksGrid />
          </div>
        </div>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
        <SignUpDialog open={signUpOpen} onOpenChange={setSignUpOpen} />
      </AppLayout>
    );
  }

  // ── Authenticated ──────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white p-8 md:p-12 mb-8 shadow-lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-xl bg-white/15 backdrop-blur p-3">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Refer & Earn</h1>
                <p className="text-blue-100 max-w-xl">
                  Give friends a head start on tax season — get ${REFERRAL_CREDIT_USD} credit
                  each time a friend completes their first paid order.
                </p>
              </div>
            </div>

            {/* Referral link card */}
            {loading ? (
              <Skeleton className="h-24 w-full bg-white/20" />
            ) : stats ? (
              <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wide text-blue-100 mb-2 font-semibold">
                      Your referral code
                    </div>
                    <div className="text-3xl font-bold tracking-widest mb-3">
                      {stats.code}
                    </div>
                    <div className="text-xs uppercase tracking-wide text-blue-100 mb-2 font-semibold">
                      Your referral link
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={stats.link}
                        readOnly
                        className="bg-white text-gray-900 font-mono text-sm"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => copy(stats.link, 'Referral link')}
                      variant="secondary"
                      className="bg-white text-blue-700 hover:bg-blue-50"
                    >
                      <Copy className="w-4 h-4 mr-2" /> Copy link
                    </Button>
                    <Button
                      onClick={() => copy(stats.code, 'Referral code')}
                      variant="secondary"
                      className="bg-white/15 hover:bg-white/25 text-white border border-white/30"
                    >
                      <Copy className="w-4 h-4 mr-2" /> Copy code
                    </Button>
                    <Button
                      onClick={handleShareNative}
                      variant="secondary"
                      className="bg-white/15 hover:bg-white/25 text-white border border-white/30"
                    >
                      <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Friends referred"
              value={stats?.totalReferred ?? 0}
              icon={<Users className="w-5 h-5" />}
              color="text-blue-600 bg-blue-50"
              loading={loading}
            />
            <StatCard
              label="Pending"
              value={stats?.pending ?? 0}
              icon={<Clock className="w-5 h-5" />}
              color="text-orange-600 bg-orange-50"
              loading={loading}
            />
            <StatCard
              label="Completed"
              value={stats?.completed ?? 0}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="text-green-600 bg-green-50"
              loading={loading}
            />
            <StatCard
              label="Credit balance"
              value={
                stats ? `$${stats.balanceUsd.toFixed(2)}` : '$0.00'
              }
              icon={<Wallet className="w-5 h-5" />}
              color="text-purple-600 bg-purple-50"
              loading={loading}
            />
          </div>

          {/* Share options + How it works */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Spread the word</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      const subject = encodeURIComponent(
                        'I think you should try Refund Connect'
                      );
                      const body = encodeURIComponent(
                        `${shareText}\n\n${shareLink}\n\nUse my code: ${stats?.code || ''}`
                      );
                      window.location.href = `mailto:?subject=${subject}&body=${body}`;
                    }}
                    disabled={!stats}
                  >
                    <Mail className="w-4 h-4 mr-2" /> Email
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                        `${shareText} ${shareLink}`
                      )}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    disabled={!stats}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Twitter / X
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                        shareLink
                      )}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    disabled={!stats}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Facebook
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      const url = `https://wa.me/?text=${encodeURIComponent(
                        `${shareText} ${shareLink}`
                      )}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    disabled={!stats}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                        shareLink
                      )}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    disabled={!stats}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> LinkedIn
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => copy(shareLink, 'Referral link')}
                    disabled={!stats}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy link
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How it works</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Share your link.</span>{' '}
                      Send it to friends, family, or post it on social.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">They sign up</span> using
                      your link or code.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">
                        They complete their first paid order
                      </span>{' '}
                      with any vetted pro.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">
                        You earn ${REFERRAL_CREDIT_USD}
                      </span>{' '}
                      in credit toward any tax service — applied automatically.
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* Referrals list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your referrals</span>
                {stats && stats.referrals.length > 0 && (
                  <Badge variant="outline" className="font-normal">
                    {stats.referrals.length} total
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : !stats || stats.referrals.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No referrals yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Share your link to get started — your stats will show up here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {stats.referrals.map((r) => (
                    <div
                      key={r.id}
                      className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {r.referred_name || r.referred_email || 'Friend'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Joined{' '}
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString()
                            : '—'}
                          {r.completed_at && (
                            <>
                              {' '}
                              • Completed first order{' '}
                              {new Date(r.completed_at).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.status === 'completed' ? (
                          <>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                            </Badge>
                            <span className="text-sm font-semibold text-green-700 flex items-center">
                              <DollarSign className="w-3 h-3" />
                              {(r.credit_amount ?? REFERRAL_CREDIT_USD).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-orange-50 text-orange-700 border-orange-200"
                          >
                            <Clock className="w-3 h-3 mr-1" /> Pending first order
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-8 text-sm text-gray-500">
            Credit is automatically applied to your account when the referred friend's
            first paid order is confirmed. View your balance in the{' '}
            <Link to="/member-portal" className="text-blue-600 hover:underline">
              Member Portal
            </Link>
            .
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}> = ({ label, value, icon, color, loading }) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
          {label}
        </span>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      )}
    </CardContent>
  </Card>
);

const HowItWorksGrid: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
    {[
      {
        icon: <Share2 className="w-5 h-5" />,
        title: 'Share your link',
        body: 'You get a unique referral link as soon as you sign up.',
      },
      {
        icon: <Users className="w-5 h-5" />,
        title: 'They sign up & pay',
        body: 'Your friend creates an account and completes their first paid tax service.',
      },
      {
        icon: <Wallet className="w-5 h-5" />,
        title: `Earn $${REFERRAL_CREDIT_USD}`,
        body: 'Credit is applied to your account automatically — no waiting, no fine print.',
      },
    ].map((step, i) => (
      <Card key={i}>
        <CardContent className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-700 mb-3">
            {step.icon}
          </div>
          <h3 className="font-semibold mb-2">{step.title}</h3>
          <p className="text-sm text-gray-600">{step.body}</p>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default Refer;
