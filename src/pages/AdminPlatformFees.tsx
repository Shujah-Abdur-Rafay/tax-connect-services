// ============================================================================
// AdminPlatformFees — /admin/platform-fees
//
// Admin-only settings page for the global platform application fee percent.
// Writes to Firestore `platform_settings/fees` (single doc) via
// platformSettingsService. The create-booking-payment edge function and the
// createTaxProPayment Firebase Function both read this doc at request time,
// so changes take effect immediately for every subsequent checkout — no
// redeploy required.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldAlert,
  Percent,
  Save,
  RefreshCw,
  TrendingUp,
  History,
  Info,
} from 'lucide-react';

import {
  fetchPlatformFeeSettings,
  savePlatformFeeSettings,
  sanitizeFeePercent,
  DEFAULT_PLATFORM_FEE_PERCENT,
  type PlatformFeeSettings,
} from '@/services/platformSettingsService';

const PREVIEW_AMOUNTS = [50, 250, 1000, 5000];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function AdminPlatformFees() {
  const { user, isAdmin, loading } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<PlatformFeeSettings | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [feeInput, setFeeInput] = useState<string>(String(DEFAULT_PLATFORM_FEE_PERCENT));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const s = await fetchPlatformFeeSettings();
      setSettings(s);
      setFeeInput(String(s.applicationFeePercent));
    } catch (e: any) {
      setFetchError(e?.message || 'Failed to load platform settings.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const parsedFee = useMemo(() => {
    const n = Number(feeInput);
    if (!Number.isFinite(n)) return null;
    return n;
  }, [feeInput]);

  const isValid =
    parsedFee !== null && parsedFee >= 0 && parsedFee <= 100;
  const isDirty =
    parsedFee !== null &&
    settings !== null &&
    sanitizeFeePercent(parsedFee) !== settings.applicationFeePercent;

  const handleSave = async () => {
    if (!isAdmin) return;
    if (parsedFee === null || !isValid) {
      toast({
        title: 'Invalid fee',
        description: 'Enter a number between 0 and 100.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const next = await savePlatformFeeSettings(parsedFee, {
        uid: user?.uid ?? null,
        email: user?.email ?? null,
        note: note.trim() ? note.trim() : null,
      });
      setSettings(next);
      setFeeInput(String(next.applicationFeePercent));
      setNote('');
      toast({
        title: 'Platform fee updated',
        description: `Every new checkout will collect ${next.applicationFeePercent}% as the platform fee.`,
      });
    } catch (e: any) {
      toast({
        title: 'Save failed',
        description:
          e?.message ||
          'Could not save platform fee. Firestore rules require admin role — verify your account.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Auth gates ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-600">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Sign in required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                You need to be signed in as a platform admin to view platform fee
                settings.
              </p>
              <Button asChild>
                <Link to="/">Go home</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-5 w-5" />
                Admin only
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-2">
                This page is restricted to platform administrators. Your account
                ({user.email}) is signed in as <strong>{user.role}</strong>.
              </p>
              <p className="text-slate-500 text-sm mb-4">
                If you believe you should have access, update your role to{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                  admin
                </code>{' '}
                in the <code>users/{user.uid}</code> Firestore doc.
              </p>
              <Button asChild variant="outline">
                <Link to="/admin">Back to admin</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const currentFee =
    settings?.applicationFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT;
  const previewFee = isValid && parsedFee !== null ? parsedFee : currentFee;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link to="/admin" className="hover:text-slate-700">
              Admin
            </Link>
            <span>/</span>
            <span className="text-slate-700">Platform fees</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Percent className="h-8 w-8 text-indigo-600" />
            Platform fees
          </h1>
          <p className="text-slate-600 mt-2 max-w-3xl">
            Set the default application fee percent the platform takes on every
            client → pro gig and booking payment. Stored in Firestore at{' '}
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-xs">
              platform_settings/fees
            </code>{' '}
            — the create-booking-payment edge function and the
            createTaxProPayment Firebase Function read this doc at request time,
            so changes take effect immediately with no redeploy.
          </p>
        </div>

        {fetchError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6 text-red-700 text-sm">
              {fetchError}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Current fee tile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Current platform fee
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-indigo-700">
                  {fetching ? '…' : currentFee}
                </span>
                <span className="text-xl text-slate-500">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                of every gig payment
              </p>
            </CardContent>
          </Card>

          {/* Last updated tile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                Last updated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-800">
                {formatDate(settings?.updatedAt)}
              </div>
              {settings?.updatedByEmail && (
                <p className="text-xs text-slate-500 mt-1">
                  by {settings.updatedByEmail}
                </p>
              )}
              {!settings?.updatedAt && !fetching && (
                <p className="text-xs text-slate-500 mt-1">
                  Doc not yet created — using default {DEFAULT_PLATFORM_FEE_PERCENT}%.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pro share tile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Pro keeps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-emerald-700">
                  {fetching ? '…' : (100 - currentFee).toFixed(2).replace(/\.00$/, '')}
                </span>
                <span className="text-xl text-slate-500">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                routed to the pro's connected account
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Edit form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Update fee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="fee">Application fee percent</Label>
              <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                <div className="relative flex-1">
                  <Input
                    id="fee"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    max={100}
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value)}
                    className="pr-8"
                  />
                  <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFeeInput(String(DEFAULT_PLATFORM_FEE_PERCENT))}
                  type="button"
                >
                  Reset to {DEFAULT_PLATFORM_FEE_PERCENT}%
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Must be between 0 and 100. Values are clamped server-side as a
                defense-in-depth check.
              </p>
              {parsedFee !== null && !isValid && (
                <p className="text-xs text-red-600 mt-1">
                  Enter a number between 0 and 100.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="note">Change reason (optional)</Label>
              <Textarea
                id="note"
                placeholder="e.g. Promotion: lowering to 15% for Q1 2026"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Saved alongside the new fee so the audit trail tells you why it
                changed.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || !isDirty || !isValid}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save fee
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={load}
                disabled={fetching || saving}
                type="button"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${fetching ? 'animate-spin' : ''}`}
                />
                Reload from Firestore
              </Button>
              {!isDirty && (
                <span className="text-xs text-slate-500">
                  No changes to save.
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Live preview at{' '}
              <span className="text-indigo-700">{previewFee}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PREVIEW_AMOUNTS.map((amount) => {
                const platformFee = (amount * previewFee) / 100;
                const netToPro = amount - platformFee;
                return (
                  <div
                    key={amount}
                    className="border border-slate-200 rounded-lg p-4 bg-white"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Order
                    </div>
                    <div className="text-xl font-bold text-slate-900 mb-3">
                      {formatCurrency(amount)}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Platform</span>
                      <span className="text-indigo-700 font-medium">
                        {formatCurrency(platformFee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-500">Pro</span>
                      <span className="text-emerald-700 font-medium">
                        {formatCurrency(netToPro)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Implementation notes */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              How this flows through the stack
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <p>
              <strong>Frontend:</strong>{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                gigOrdersService.requestOrderPayment
              </code>{' '}
              now calls{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                fetchPlatformFeePercent()
              </code>{' '}
              before invoking the edge function, so the percent submitted with
              each checkout matches whatever is saved here.
            </p>
            <p>
              <strong>Edge function:</strong>{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                create-booking-payment
              </code>{' '}
              falls back to reading{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                platform_settings/fees
              </code>{' '}
              via the Firestore REST API when{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                applicationFeePercent
              </code>{' '}
              isn't provided, so direct API callers also get the live value.
            </p>
            <p>
              <strong>Firebase function:</strong>{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                createTaxProPayment
              </code>{' '}
              reads the same doc via{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                admin.firestore()
              </code>{' '}
              and uses it as the default fee when none is passed in the request.
            </p>
            <p>
              <strong>Security:</strong> Firestore rules must restrict
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded mx-1">
                write
              </code>
              on
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded mx-1">
                platform_settings/&#123;docId&#125;
              </code>
              to admin role users only. Public read is intentional so the edge
              function can fetch the doc without service-account credentials.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
