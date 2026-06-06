import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { getClientDocumentURL } from '@/services/firebaseStorageService';

interface DocumentPreviewProps {
  document: {
    id: string;
    file_name: string;
    file_type: string;
    storage_path: string;
    download_url?: string;
  } | null;
  onClose: () => void;
}

export default function DocumentPreview({
  document: docRecord,
  onClose,
}: DocumentPreviewProps) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadDocument = async () => {
      if (!docRecord) return;
      setLoading(true);
      try {
        // Prefer the long-lived download_url cached on the Firestore doc.
        // Fall back to a fresh getDownloadURL() against Firebase Storage.
        const resolved =
          docRecord.download_url ||
          (await getClientDocumentURL(docRecord.storage_path));
        if (!cancelled) setUrl(resolved || '');
      } catch (error) {
        console.error('Error loading document:', error);
        if (!cancelled) setUrl('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [docRecord]);

  const downloadDocument = () => {
    if (!url || !docRecord) return;
    const a = window.document.createElement('a');
    a.href = url;
    a.download = docRecord.file_name || 'document';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  if (!docRecord) return null;

  return (
    <Dialog open={!!docRecord} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{docRecord.file_name}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadDocument}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p>Loading preview...</p>
            </div>
          ) : docRecord.file_type === 'application/pdf' ? (
            <iframe src={url} className="w-full h-full border-0" />
          ) : docRecord.file_type?.startsWith('image/') ? (
            <img
              src={url}
              alt={docRecord.file_name}
              className="max-w-full h-auto mx-auto"
            />
          ) : (
            <div className="text-center p-8">
              <p>Preview not available for this file type</p>
              <Button onClick={downloadDocument} className="mt-4">
                Download to View
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
