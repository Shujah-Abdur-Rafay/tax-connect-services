import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DocumentPreview from '@/components/DocumentPreview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye,
  FileText,
  Folder,
  Loader2,
  RefreshCw,
  User as UserIcon,
  Inbox,
} from 'lucide-react';

/** Allowed status transitions for a tax professional reviewing a doc. */
const STATUS_OPTIONS = [
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'needs_changes', label: 'Needs Changes' },
] as const;

type DocStatus = (typeof STATUS_OPTIONS)[number]['value'];

interface SharedDoc {
  id: string;
  owner_id: string;
  professional_id: string;
  file_name: string;
  storage_path: string;
  download_url?: string;
  file_type?: string;
  file_size?: number;
  folder?: string;
  status: DocStatus;
  uploaded_at?: Timestamp | Date | string | null;
  updated_at?: Timestamp | Date | string | null;
}

interface ClientInfo {
  id: string;
  name: string;
  email: string;
}

const STATUS_STYLES: Record<DocStatus, string> = {
  uploaded: 'bg-slate-100 text-slate-700 border-slate-200',
  in_review: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  needs_changes: 'bg-rose-100 text-rose-800 border-rose-200',
};

function formatDate(value: SharedDoc['uploaded_at']): string {
  if (!value) return '—';
  try {
    let d: Date;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === 'string') {
      d = new Date(value);
    } else if (
      value &&
      typeof (value as Timestamp).toDate === 'function'
    ) {
      d = (value as Timestamp).toDate();
    } else {
      return '—';
    }
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProDocumentsInbox() {
  const { user, isProfessional, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<SharedDoc[]>([]);
  const [clients, setClients] = useState<Record<string, ClientInfo>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SharedDoc | null>(null);

  // Load shared documents for this pro.
  const loadDocs = async () => {
    if (!user || !db) return;
    setLoading(true);
    try {
      // Uses composite index: client_documents (professional_id ASC, uploaded_at DESC)
      const q = query(
        collection(db, 'client_documents'),
        where('professional_id', '==', user.uid),
        orderBy('uploaded_at', 'desc'),
      );
      const snap = await getDocs(q);
      const rows: SharedDoc[] = snap.docs.map((d) => {
        const data = d.data() as Omit<SharedDoc, 'id'>;
        return {
          id: d.id,
          ...data,
          status: (data.status as DocStatus) || 'uploaded',
        };
      });
      setDocs(rows);

      // Hydrate client display info for grouping headers.
      const uniqueOwnerIds = Array.from(
        new Set(rows.map((r) => r.owner_id).filter(Boolean)),
      );
      const missing = uniqueOwnerIds.filter((id) => !clients[id]);
      if (missing.length > 0) {
        const fetched: Record<string, ClientInfo> = {};
        await Promise.all(
          missing.map(async (ownerId) => {
            try {
              const userSnap = await getDoc(doc(db, 'users', ownerId));
              if (userSnap.exists()) {
                const u = userSnap.data() as { name?: string; email?: string };
                fetched[ownerId] = {
                  id: ownerId,
                  name: u.name || 'Unknown Client',
                  email: u.email || '',
                };
              } else {
                fetched[ownerId] = {
                  id: ownerId,
                  name: 'Unknown Client',
                  email: '',
                };
              }
            } catch {
              fetched[ownerId] = {
                id: ownerId,
                name: 'Unknown Client',
                email: '',
              };
            }
          }),
        );
        setClients((prev) => ({ ...prev, ...fetched }));
      }
    } catch (err) {
      console.error('Failed to load shared documents:', err);
      toast({
        title: 'Failed to load documents',
        description:
          err instanceof Error ? err.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/');
      return;
    }
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Update status — ONLY { status, updated_at } per Firestore rules.
  const handleStatusChange = async (
    docId: string,
    nextStatus: DocStatus,
  ) => {
    if (!db) return;
    setUpdatingId(docId);
    try {
      await updateDoc(doc(db, 'client_documents', docId), {
        status: nextStatus,
        updated_at: serverTimestamp(),
      });
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, status: nextStatus } : d,
        ),
      );
      toast({
        title: 'Status updated',
        description: `Document marked as "${STATUS_OPTIONS.find(
          (o) => o.value === nextStatus,
        )?.label}".`,
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      toast({
        title: 'Update failed',
        description:
          err instanceof Error
            ? err.message
            : 'You may not have permission to update this document.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Group docs by client (owner_id), preserving the orderBy uploaded_at desc.
  const grouped = useMemo(() => {
    const map = new Map<string, SharedDoc[]>();
    for (const d of docs) {
      const arr = map.get(d.owner_id) || [];
      arr.push(d);
      map.set(d.owner_id, arr);
    }
    return Array.from(map.entries());
  }, [docs]);

  const totalCount = docs.length;
  const needsAttention = docs.filter(
    (d) => d.status === 'uploaded' || d.status === 'in_review',
  ).length;

  // Gate to professionals only.
  const showAccessGate = !authLoading && user && !isProfessional;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header onToggleNotifications={() => {}} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Inbox className="h-4 w-4" />
              <span>Pro Workspace</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">
              Documents Shared With Me
            </h1>
            <p className="text-slate-600 mt-1">
              Review files your clients have shared and update their status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
              <Badge variant="secondary">{totalCount} total</Badge>
              {needsAttention > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  {needsAttention} need attention
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              onClick={loadDocs}
              disabled={loading}
              size="sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {showAccessGate ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Pro accounts only
              </h2>
              <p className="text-slate-600">
                This inbox is reserved for tax professionals on the platform.
              </p>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Loading shared documents…</p>
            </CardContent>
          </Card>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Inbox className="h-6 w-6 text-slate-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                No documents shared yet
              </h2>
              <p className="text-slate-600 max-w-md mx-auto">
                When a client shares a document with you, it will appear here
                grouped by client. You can preview the file and update its
                review status.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([ownerId, files]) => {
              const client = clients[ownerId];
              return (
                <Card key={ownerId} className="overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="flex items-center justify-between gap-3 text-base">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <UserIcon className="h-4 w-4 text-blue-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {client?.name || 'Loading client…'}
                          </p>
                          {client?.email && (
                            <p className="text-xs text-slate-500 truncate">
                              {client.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {files.length} {files.length === 1 ? 'file' : 'files'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {files.map((d) => (
                        <li
                          key={d.id}
                          className="p-4 flex flex-col md:flex-row md:items-center gap-4"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5 text-slate-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="font-medium text-slate-900 truncate"
                                title={d.file_name}
                              >
                                {d.file_name}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                                {d.folder && (
                                  <span className="inline-flex items-center gap-1">
                                    <Folder className="h-3 w-3" />
                                    {d.folder}
                                  </span>
                                )}
                                <span>Uploaded {formatDate(d.uploaded_at)}</span>
                                {d.file_size ? (
                                  <span>{formatBytes(d.file_size)}</span>
                                ) : null}
                              </div>
                              <div className="mt-2 md:hidden">
                                <Badge
                                  variant="outline"
                                  className={STATUS_STYLES[d.status]}
                                >
                                  {STATUS_OPTIONS.find(
                                    (o) => o.value === d.status,
                                  )?.label || d.status}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 md:gap-3 md:shrink-0">
                            <div className="hidden md:block">
                              <Badge
                                variant="outline"
                                className={STATUS_STYLES[d.status]}
                              >
                                {STATUS_OPTIONS.find(
                                  (o) => o.value === d.status,
                                )?.label || d.status}
                              </Badge>
                            </div>
                            <Select
                              value={d.status}
                              onValueChange={(v) =>
                                handleStatusChange(d.id, v as DocStatus)
                              }
                              disabled={updatingId === d.id}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewDoc(d)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

      <DocumentPreview
        document={
          previewDoc
            ? {
                id: previewDoc.id,
                file_name: previewDoc.file_name,
                file_type: previewDoc.file_type || '',
                storage_path: previewDoc.storage_path,
                download_url: previewDoc.download_url,
              }
            : null
        }
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
