import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  fetchCrmContacts,
  resyncContact,
  syncContactToCrm,
  type CrmContact,
  type EnrollmentLevel,
} from '@/services/crmSyncService';
import { getAllApplications } from '@/services/enrollmentService';
import { toast } from 'sonner';
import {
  Loader2,
  ShieldAlert,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Copy,
  Users,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  ExternalLink,
  UploadCloud,
} from 'lucide-react';

type LevelFilter = 'all' | EnrollmentLevel | 'Unknown';

const LEVEL_OPTIONS: LevelFilter[] = [
  'all',
  'Directory Listing',
  'Associate',
  'Professional',
  'Premier Partner',
  'Unknown',
];

const LEVEL_COLORS: Record<string, string> = {
  'Directory Listing': 'bg-gray-100 text-gray-700 border-gray-200',
  Associate: 'bg-blue-100 text-blue-700 border-blue-200',
  Professional: 'bg-purple-100 text-purple-700 border-purple-200',
  'Premier Partner': 'bg-amber-100 text-amber-800 border-amber-200',
  Unknown: 'bg-slate-100 text-slate-600 border-slate-200',
};

interface MergedRow {
  key: string;
  email: string;
  name: string;
  phone: string;
  level: string;
  source: string;
  internalId: string;
  lastSyncOk: boolean;
  lastSyncError?: string;
  lastSyncedAt?: Date | null;
  origin: 'crm' | 'application' | 'user';
}

const AdminCrmContacts: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [resyncing, setResyncing] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading, navigate]);

  const loadAll = async () => {
    setLoadingData(true);
    try {
      // 1) CRM-synced contacts (authoritative for level)
      const crm: CrmContact[] = await fetchCrmContacts();
      const byEmail = new Map<string, MergedRow>();
      for (const c of crm) {
        if (!c.email) continue;
        byEmail.set(c.email.toLowerCase(), {
          key: c.id,
          email: c.email,
          name: c.name,
          phone: c.phone,
          level: c.level,
          source: c.source,
          internalId: c.internalId,
          lastSyncOk: c.lastSyncOk,
          lastSyncError: c.lastSyncError,
          lastSyncedAt: c.lastSyncedAt,
          origin: 'crm',
        });
      }

      // 2) Tax-professional applications (Directory Listing default)
      try {
        const apps = await getAllApplications();
        for (const a of apps) {
          const email = (a.email || '').toLowerCase();
          if (!email) continue;
          if (byEmail.has(email)) continue;
          byEmail.set(email, {
            key: `app_${a.id}`,
            email: a.email,
            name: `${a.profile?.firstName || ''} ${a.profile?.lastName || ''}`.trim(),
            phone: a.profile?.phone || '',
            level: 'Directory Listing',
            source: 'enrollment-application',
            internalId: a.id || '',
            lastSyncOk: false,
            lastSyncError: 'Not yet synced to CRM',
            lastSyncedAt: null,
            origin: 'application',
          });
        }
      } catch (e) {
        console.warn('Loading applications failed:', e);
      }

      // 3) Users collection (paid members not yet in crm_contacts)
      try {
        const usersSnap = await getDocs(
          query(collection(db, 'users'), orderBy('membershipUpgradedAt', 'desc'))
        ).catch(() => getDocs(collection(db, 'users')));
        usersSnap.docs.forEach((d) => {
          const u = d.data() as Record<string, unknown>;
          const email = String(u.email || '').toLowerCase();
          if (!email) return;
          if (byEmail.has(email)) return;
          const level =
            (u.membershipLevel as string) ||
            (u.membership_level as string) ||
            'Directory Listing';
          byEmail.set(email, {
            key: `user_${d.id}`,
            email: String(u.email),
            name:
              (u.displayName as string) ||
              (u.fullName as string) ||
              `${(u.firstName as string) || ''} ${(u.lastName as string) || ''}`.trim(),
            phone: (u.phone as string) || '',
            level,
            source: 'user-record',
            internalId: d.id,
            lastSyncOk: false,
            lastSyncError: 'Not yet synced to CRM',
            lastSyncedAt: null,
            origin: 'user',
          });
        });
      } catch (e) {
        console.warn('Loading users failed:', e);
      }

      setRows(Array.from(byEmail.values()));
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) loadAll();
  }, [user, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (levelFilter !== 'all' && r.level !== levelFilter) return false;
      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q)
      );
    });
  }, [rows, levelFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      total: rows.length,
      'Directory Listing': 0,
      Associate: 0,
      Professional: 0,
      'Premier Partner': 0,
      Unknown: 0,
      synced: 0,
    };
    rows.forEach((r) => {
      if (c[r.level] !== undefined) c[r.level] += 1;
      else c.Unknown += 1;
      if (r.origin === 'crm' && r.lastSyncOk) c.synced += 1;
    });
    return c;
  }, [rows]);

  const handleResync = async (row: MergedRow) => {
    setResyncing(row.email);
    try {
      const res = await resyncContact({
        email: row.email,
        name: row.name || undefined,
        phone: row.phone || undefined,
        enrollmentLevel: row.level,
        source: row.source || 'admin-resync',
        internalId: row.internalId || undefined,
      });
      if (res.ok) {
        toast.success(`Synced ${row.email} to CRM`);
      } else {
        toast.error(`CRM sync failed: ${res.error || 'unknown error'}`);
      }
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setResyncing(null);
    }
  };

  const handleSyncAll = async () => {
    if (!confirm(`Sync all ${filtered.length} contacts to the Famous CRM?`)) return;
    setBulkSyncing(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const row of filtered) {
        const res = await syncContactToCrm({
          email: row.email,
          name: row.name || undefined,
          phone: row.phone || undefined,
          enrollmentLevel: row.level,
          source: row.source || 'admin-bulk-sync',
          internalId: row.internalId || undefined,
        });
        if (res.ok) okCount += 1;
        else failCount += 1;
      }
      toast.success(`Bulk sync complete: ${okCount} ok, ${failCount} failed`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk sync failed');
    } finally {
      setBulkSyncing(false);
    }
  };

  const handleExportCsv = () => {
    const header = ['Name', 'Email', 'Phone', 'Enrollment Level', 'Source', 'Synced'];
    const lines = [header.join(',')];
    filtered.forEach((r) => {
      const cells = [
        r.name,
        r.email,
        r.phone,
        r.level,
        r.source,
        r.lastSyncOk ? 'yes' : 'no',
      ].map((c) => `"${String(c || '').replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (row: MergedRow) => {
    const text = `${row.name}\n${row.email}\n${row.phone}\n${row.level}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success('Contact info copied'),
      () => toast.error('Failed to copy')
    );
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
            You don't have access to the CRM contacts page.
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
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <Users className="h-3.5 w-3.5" />
              CRM Sync
            </div>
            <h1 className="text-3xl font-bold text-gray-900">CRM Contacts &amp; Enrollment</h1>
            <p className="text-gray-600 mt-1">
              Every enrollee, synced to the Famous CRM with Name, Email, Phone, and
              Enrollment Level so you can track and interact with them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/crm-broadcast"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Mail className="h-4 w-4" />
              Send Broadcast
            </Link>
            <button
              onClick={loadAll}
              disabled={loadingData}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={handleSyncAll}
              disabled={bulkSyncing || filtered.length === 0}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {bulkSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Sync visible to CRM
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total', value: counts.total, color: 'bg-gray-50 text-gray-700' },
            {
              label: 'Directory',
              value: counts['Directory Listing'],
              color: 'bg-gray-50 text-gray-700',
            },
            {
              label: 'Associate',
              value: counts.Associate,
              color: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Professional',
              value: counts.Professional,
              color: 'bg-purple-50 text-purple-700',
            },
            {
              label: 'Premier Partner',
              value: counts['Premier Partner'],
              color: 'bg-amber-50 text-amber-700',
            },
            {
              label: 'Synced to CRM',
              value: counts.synced,
              color: 'bg-green-50 text-green-700',
            },
          ].map((t) => (
            <div
              key={t.label}
              className={`rounded-xl border border-gray-100 bg-white p-4`}
            >
              <div className="text-xs text-gray-500 font-medium">{t.label}</div>
              <div className={`text-2xl font-bold mt-1 ${t.color.split(' ')[1] || ''}`}>
                {t.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or phone..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l === 'all' ? 'All Levels' : l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {loadingData ? (
            <div className="p-12 text-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading contacts…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No contacts match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Enrollment Level</th>
                    <th className="py-3 px-4">CRM Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const levelClass =
                      LEVEL_COLORS[r.level] || LEVEL_COLORS.Unknown;
                    return (
                      <tr
                        key={r.key}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">
                            {r.name || <span className="text-gray-400 italic">No name</span>}
                          </div>
                          <div className="text-xs text-gray-400">
                            via {r.source || r.origin}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{r.email}</td>
                        <td className="py-3 px-4 text-gray-700">
                          {r.phone || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${levelClass}`}
                          >
                            {r.level}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {r.origin === 'crm' && r.lastSyncOk ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Synced
                              {r.lastSyncedAt && (
                                <span className="text-gray-400 ml-1">
                                  {r.lastSyncedAt.toLocaleDateString()}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                              <XCircle className="h-3.5 w-3.5" />
                              {r.lastSyncError || 'Not synced'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={`mailto:${r.email}`}
                              title="Email"
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                            >
                              <Mail className="h-4 w-4" />
                            </a>
                            {r.phone && (
                              <a
                                href={`tel:${r.phone.replace(/[^+\d]/g, '')}`}
                                title="Call"
                                className="p-1.5 rounded hover:bg-green-50 text-green-600"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              onClick={() => handleCopy(r)}
                              title="Copy"
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleResync(r)}
                              disabled={resyncing === r.email}
                              title="Re-sync to CRM"
                              className="p-1.5 rounded hover:bg-purple-50 text-purple-600 disabled:opacity-50"
                            >
                              {resyncing === r.email ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UploadCloud className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            How this works
          </div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li>
              New enrollment applications auto-sync as <strong>Directory Listing</strong>{' '}
              with Name, Email, and Phone.
            </li>
            <li>
              When a member upgrades to Associate, Professional, or Premier Partner, their
              CRM record is updated with the new level + tag.
            </li>
            <li>
              Existing applicants or users not yet in <code>crm_contacts</code> are listed
              here as "Not synced" — click the upload icon (or "Sync visible to CRM") to
              push them into the Famous CRM.
            </li>
            <li>
              Use the Email / Call icons to reach out directly, or export the filtered
              list as CSV for outbound campaigns.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminCrmContacts;
