import { useState, useEffect, useCallback } from 'react';
import { FileText, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deleteClientDocument } from '@/services/firebaseStorageService';
import { useAuth } from '@/contexts/AuthContext';
import ClientDocumentUpload from './ClientDocumentUpload';
import DocumentPreview from './DocumentPreview';
import { toast } from 'sonner';

interface ClientDoc {
  id: string;
  owner_id: string;
  professional_id?: string | null;
  file_name: string;
  storage_path: string;
  status: string;
  file_type?: string;
  file_size?: number;
  folder?: string;
  download_url?: string;
  uploaded_at?: any;
}

export default function ClientDocumentManager() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ClientDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<ClientDoc | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'client_documents'),
        where('owner_id', '==', user.uid),
        orderBy('uploaded_at', 'desc')
      );
      const snap = await getDocs(q);
      const rows: ClientDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ClientDoc, 'id'>),
      }));
      setDocuments(rows);
    } catch (error: any) {
      console.error('Failed to load client_documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const deleteDocument = async (docToDelete: ClientDoc) => {
    if (!confirm('Delete this document?')) return;

    try {
      // 1. Storage object
      if (docToDelete.storage_path) {
        try {
          await deleteClientDocument(docToDelete.storage_path);
        } catch (storageErr) {
          // Non-fatal: object may already be gone; we still remove the Firestore record.
          console.warn('Storage delete failed, continuing:', storageErr);
        }
      }
      // 2. Firestore record
      await deleteDoc(doc(db, 'client_documents', docToDelete.id));

      toast.success('Document deleted');
      loadDocuments();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document');
    }
  };

  const filtered =
    filter === 'all'
      ? documents
      : documents.filter((d) => (d.folder || 'general') === filter);
  const folders = ['all', ...new Set(documents.map((d) => d.folder || 'general'))];

  const formatDate = (ts: any): string => {
    if (!ts) return '';
    // Firestore Timestamp has toDate(); also handle Date / string fallbacks.
    if (typeof ts?.toDate === 'function') return ts.toDate().toLocaleDateString();
    if (ts instanceof Date) return ts.toLocaleDateString();
    const parsed = new Date(ts);
    return isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <ClientDocumentUpload onUploadComplete={loadDocuments} />

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold">My Documents</h3>
          <div className="flex gap-2 flex-wrap">
            {folders.map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No documents uploaded yet
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{d.file_name}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(d.uploaded_at)} •{' '}
                      {((d.file_size || 0) / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Badge variant="outline">{d.folder || 'general'}</Badge>
                  {d.status && d.status !== 'uploaded' && (
                    <Badge variant="secondary">{d.status}</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDoc(d)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteDocument(d)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DocumentPreview
        document={selectedDoc as any}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
}
