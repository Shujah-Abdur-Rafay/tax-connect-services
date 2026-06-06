import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Loader2,
  ShieldAlert,
  Send,
  Mail,
  Eye,
  Users,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import {
  fetchCrmContacts,
  type CrmContact,
  type EnrollmentLevel,
} from '@/services/crmSyncService';
import {
  startBroadcast,
  fetchRecentBroadcasts,
  fetchBroadcastRecipients,
  BROADCAST_BATCH_SIZE,
  type BroadcastSummary,
  type BroadcastRecipientRecord,
  type BroadcastProgress,
} from '@/services/broadcastService';

const ALL_LEVELS: EnrollmentLevel[] = [
  'Directory Listing',
  'Associate',
  'Professional',
  'Premier Partner',
];

const LEVEL_COLORS: Record<string, string> = {
  'Directory Listing': 'bg-gray-100 text-gray-700 border-gray-200',
  Associate: 'bg-blue-100 text-blue-700 border-blue-200',
  Professional: 'bg-purple-100 text-purple-700 border-purple-200',
  'Premier Partner': 'bg-amber-100 text-amber-800 border-amber-200',
};

const DEFAULT_SUBJECT = 'An update from Refund Connect';
const DEFAULT_BODY = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
  <h2 style="color: #2563eb;">Hello from Refund Connect</h2>
  <p>Hi there,</p>
  <p>We wanted to share a quick update with you about your enrollment.</p>
  <p>
    <a href="https://www.refund-connect.com" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Visit Refund Connect</a>
  </p>
  <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
    You're receiving this because you enrolled with Refund Connect.
  </p>
</div>`;

const AdminCrmBroadcast: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const [selectedLevels, setSelectedLevels] = useState<EnrollmentLevel[]>([
    'Directory Listing',
    'Associate',
    'Professional',
    'Premier Partner',
  ]);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [htmlBody, setHtmlBody] = useState(DEFAULT_BODY);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);

  const [history, setHistory] = useState<BroadcastSummary[]>([]);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [historyRecipients, setHistoryRecipients] = useState<
    BroadcastRecipientRecord[]
  >([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading, navigate]);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const list = await fetchCrmContacts();
      setContacts(list);
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadHistory = async () => {
    const recent = await fetchRecentBroadcasts(25);
    setHistory(recent);
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadContacts();
      loadHistory();
    }
  }, [user, isAdmin]);

  const toggleLevel = (lvl: EnrollmentLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl]
    );
  };

  /** Recipients matching the currently-selected enrollment levels. */
  const recipients = useMemo(() => {
    const set = new Set(selectedLevels as string[]);
    // Deduplicate by email (case-insensitive)
    const byEmail = new Map<
      string,
      { email: string; name: string; level: EnrollmentLevel | 'Unknown' }
    >();
    for (const c of contacts) {
      if (!c.email || !c.email.includes('@')) continue;
      if (!set.has(c.level)) continue;
      const key = c.email.trim().toLowerCase();
      if (!byEmail.has(key)) {
        byEmail.set(key, {
          email: c.email,
          name: c.name,
          level: c.level,
        });
      }
    }
    return Array.from(byEmail.values());
  }, [contacts, selectedLevels]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      'Directory Listing': 0,
      Associate: 0,
      Professional: 0,
      'Premier Partner': 0,
    };
    for (const ct of contacts) {
      if (c[ct.level] !== undefined) c[ct.level] += 1;
    }
    return c;
  }, [contacts]);

  const totalBatches = Math.ceil(recipients.length / BROADCAST_BATCH_SIZE);

  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error('No recipients match the selected levels.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    if (!htmlBody.trim()) {
      toast.error('Email body is required.');
      return;
    }
    if (selectedLevels.length === 0) {
      toast.error('Select at least one enrollment level.');
      return;
    }

    const ok = window.confirm(
      `Send this email to ${recipients.length} recipient${
        recipients.length === 1 ? '' : 's'
      } across ${totalBatches} batch${
        totalBatches === 1 ? '' : 'es'
      } of ${BROADCAST_BATCH_SIZE}?\n\nThis cannot be undone.`
    );
    if (!ok) return;

    setSending(true);
    setProgress({
      total: recipients.length,
      sent: 0,
      failed: 0,
      inFlight: 0,
      currentBatch: 0,
      totalBatches,
    });

    try {
      const result = await startBroadcast(
        {
          subject: subject.trim(),
          html: htmlBody,
          levels: selectedLevels,
          recipients,
          createdBy: user?.email || user?.uid || 'admin',
        },
        (p) => setProgress(p)
      );

      if (result.failureCount === 0) {
        toast.success(
          `Broadcast complete — ${result.successCount} email${
            result.successCount === 1 ? '' : 's'
          } sent.`
        );
      } else {
        toast.warning(
          `Broadcast finished with ${result.successCount} sent, ${result.failureCount} failed. See history for details.`
        );
      }
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Broadcast failed');
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const handleOpenHistory = async (id: string) => {
    if (openHistoryId === id) {
      setOpenHistoryId(null);
      setHistoryRecipients([]);
      return;
    }
    setOpenHistoryId(id);
    setLoadingRecipients(true);
    try {
      const rows = await fetchBroadcastRecipients(id);
      setHistoryRecipients(rows);
    } finally {
      setLoadingRecipients(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <ShieldAlert className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <h2 className="font-semibold text-red-900">Admin only</h2>
          <p className="text-sm text-red-700 mt-1">
            You don't have access to the CRM broadcast tool.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <Link
              to="/admin/crm-contacts"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to CRM Contacts
            </Link>
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <Mail className="h-3.5 w-3.5" />
              Email Blast
            </div>
            <h1 className="text-3xl font-bold text-gray-900">CRM Broadcast</h1>
            <p className="text-gray-600 mt-1">
              Email enrollees by level. Sends in batches of {BROADCAST_BATCH_SIZE},
              with per-recipient delivery tracked in <code>broadcast_log</code>.
            </p>
          </div>
          <button
            onClick={() => {
              loadContacts();
              loadHistory();
            }}
            disabled={loadingContacts}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingContacts ? 'animate-spin' : ''}`}
            />
            Refresh contacts
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — Compose */}
          <div className="space-y-6">
            {/* Audience */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" /> Audience
                </h2>
                <span className="text-xs text-gray-500">
                  {loadingContacts ? 'Loading…' : `${contacts.length} CRM contacts`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_LEVELS.map((lvl) => {
                  const active = selectedLevels.includes(lvl);
                  return (
                    <label
                      key={lvl}
                      className={`flex items-center justify-between gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleLevel(lvl)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${LEVEL_COLORS[lvl]}`}
                        >
                          {lvl}
                        </span>
                      </span>
                      <span className="text-sm text-gray-500 tabular-nums">
                        {counts[lvl] || 0}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-sm">
                  <div className="text-gray-500">Matching recipients</div>
                  <div className="text-xl font-bold text-gray-900">
                    {recipients.length}
                  </div>
                </div>
                <div className="text-sm text-right">
                  <div className="text-gray-500">Batches</div>
                  <div className="text-xl font-bold text-gray-900">
                    {totalBatches} × {BROADCAST_BATCH_SIZE}
                  </div>
                </div>
              </div>
            </div>

            {/* Compose */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4 text-purple-600" /> Compose
              </h2>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                HTML Body
              </label>
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={14}
                spellCheck={false}
                placeholder="<div>Your email HTML…</div>"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                Tip: keep widths to 600px max and use inline styles — many email
                clients strip <code>&lt;style&gt;</code> blocks.
              </p>
            </div>

            {/* Send + progress */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <button
                onClick={handleSend}
                disabled={
                  sending ||
                  recipients.length === 0 ||
                  !subject.trim() ||
                  !htmlBody.trim()
                }
                className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending
                  ? 'Sending broadcast…'
                  : `Send to ${recipients.length} recipient${
                      recipients.length === 1 ? '' : 's'
                    }`}
              </button>

              {progress && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      Batch {progress.currentBatch} of {progress.totalBatches}
                    </span>
                    <span>
                      {progress.sent + progress.failed} / {progress.total}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-purple-600 transition-all"
                      style={{
                        width: `${
                          progress.total
                            ? ((progress.sent + progress.failed) /
                                progress.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {progress.sent} sent
                    </span>
                    <span className="text-red-700 inline-flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      {progress.failed} failed
                    </span>
                    {progress.inFlight > 0 && (
                      <span className="text-gray-500">
                        ({progress.inFlight} in flight)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Preview + recipient list */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" /> Live Preview
              </h2>
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                <div className="bg-white px-4 py-2 border-b border-gray-200 text-xs text-gray-500">
                  <div>
                    <span className="text-gray-400">Subject:</span>{' '}
                    <span className="text-gray-900 font-medium">
                      {subject || <em className="text-gray-400">(empty)</em>}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <span className="text-gray-400">To:</span>{' '}
                    <span className="text-gray-700">
                      {recipients.length === 0
                        ? 'no recipients'
                        : `${recipients.length} contact${
                            recipients.length === 1 ? '' : 's'
                          } — ${selectedLevels.join(', ')}`}
                    </span>
                  </div>
                </div>
                <div
                  className="bg-white p-4 max-h-[420px] overflow-y-auto"
                  // Live preview of the html body
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
              </div>
            </div>

            {/* Recipients preview */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" /> Recipients (first 25)
              </h2>
              {recipients.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No CRM contacts match the selected levels. Add contacts at{' '}
                  <Link
                    to="/admin/crm-contacts"
                    className="text-blue-600 hover:underline"
                  >
                    /admin/crm-contacts
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm max-h-72 overflow-y-auto">
                  {recipients.slice(0, 25).map((r) => (
                    <li
                      key={r.email}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {r.name || (
                            <span className="text-gray-400 italic">No name</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {r.email}
                        </div>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
                          LEVEL_COLORS[r.level] ||
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {r.level}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {recipients.length > 25 && (
                <p className="text-xs text-gray-500 mt-2">
                  +{recipients.length - 25} more…
                </p>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        <div className="mt-10 bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <History className="h-4 w-4 text-gray-600" /> Recent broadcasts
            </h2>
            <button
              onClick={loadHistory}
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> refresh
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">
              No broadcasts yet. Send your first email blast above.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((h) => (
                <div key={h.id} className="py-3">
                  <button
                    onClick={() => handleOpenHistory(h.id)}
                    className="w-full flex flex-col md:flex-row md:items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {h.subject || <em className="text-gray-400">(no subject)</em>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {h.createdAt
                          ? h.createdAt.toLocaleString()
                          : 'pending'}{' '}
                        · {h.levels.join(', ') || 'all levels'} ·{' '}
                        {h.totalRecipients} recipient
                        {h.totalRecipients === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {h.successCount}
                      </span>
                      <span className="text-red-700 inline-flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> {h.failureCount}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          h.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : h.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : h.status === 'sending'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                  </button>

                  {openHistoryId === h.id && (
                    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      {loadingRecipients ? (
                        <div className="text-sm text-gray-500 inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading
                          recipients…
                        </div>
                      ) : historyRecipients.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No recipient records for this broadcast.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-gray-500">
                              <tr className="text-left">
                                <th className="py-1.5 pr-3">Email</th>
                                <th className="py-1.5 pr-3">Level</th>
                                <th className="py-1.5 pr-3">Status</th>
                                <th className="py-1.5 pr-3">Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historyRecipients.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-t border-gray-200"
                                >
                                  <td className="py-1.5 pr-3 text-gray-800">
                                    {r.email}
                                  </td>
                                  <td className="py-1.5 pr-3 text-gray-600">
                                    {r.level}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    {r.status === 'sent' ? (
                                      <span className="text-green-700 inline-flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> sent
                                      </span>
                                    ) : r.status === 'failed' ? (
                                      <span className="text-red-700 inline-flex items-center gap-1">
                                        <XCircle className="h-3 w-3" /> failed
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">
                                        {r.status}
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="py-1.5 pr-3 text-red-600 truncate max-w-[260px]"
                                    title={r.error}
                                  >
                                    {r.error || ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
          <div className="font-semibold mb-1">How it works</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li>
              Recipients are sourced from <code>crm_contacts</code> (synced by{' '}
              <code>crmSyncService</code>). Filter by Directory Listing, Associate,
              Professional, or Premier Partner.
            </li>
            <li>
              Each batch of {BROADCAST_BATCH_SIZE} sends in parallel via the
              <code> send-notification-email </code>edge function
              (<code>type: 'broadcast'</code>).
            </li>
            <li>
              Every attempt is tracked in Firestore at{' '}
              <code>broadcast_log/{'{broadcastId}'}/recipients</code> with status,
              error, and timestamps so you can re-send to failures later.
            </li>
            <li>
              If the edge function deploy is lagging the <code>'broadcast'</code>
              type, the recipient rows will be marked <code>failed</code> with the
              edge-function error — once redeployed, no frontend changes are
              required.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminCrmBroadcast;
