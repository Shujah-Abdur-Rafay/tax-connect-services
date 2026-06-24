import { useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadClientDocument } from '@/services/firebaseStorageService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { emailNotificationService } from '@/services/emailNotificationService';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function ClientDocumentUpload({
  onUploadComplete,
}: {
  onUploadComplete?: () => void;
}) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState('general');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: Invalid file type`);
        return false;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: File too large (max 10MB)`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const uploadFiles = async () => {
    if (!user || files.length === 0) return;
    setUploading(true);

    try {
      for (const file of files) {
        // 1. Upload binary to Firebase Storage
        const uploaded = await uploadClientDocument(user.uid, folder, file);

        // 2. Persist metadata to Firestore `client_documents`
        await addDoc(collection(db, 'client_documents'), {
          owner_id: user.uid,
          professional_id: null, // assigned via DocumentSharingManager
          file_name: file.name,
          storage_path: uploaded.storagePath,
          status: 'uploaded',
          uploaded_at: serverTimestamp(),
          // Convenience fields used by the UI
          file_type: uploaded.contentType,
          file_size: uploaded.size,
          folder,
          download_url: uploaded.downloadURL,
          shared_with: [], // [{ professional_id, permission, status, shared_at, shared_by }]
        });

        // 3. Best-effort notification to the assigned professional (if any)
        try {
          await emailNotificationService.notifyDocumentUpload(
            user.displayName || user.email || 'Client',
            file.name,
            folder,
            'professional@example.com', // TODO: resolve from assigned professional record
            'Tax Professional'
          );
        } catch (emailError) {
          console.error('Failed to send notification:', emailError);
        }
      }

      toast.success('Documents uploaded successfully');
      setFiles([]);
      onUploadComplete?.();
    } catch (error: any) {
      toast.error(error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Upload Tax Documents</h3>

      <Select value={folder} onValueChange={setFolder}>
        <SelectTrigger className="mb-4">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="general">General</SelectItem>
          <SelectItem value="w2">W-2 Forms</SelectItem>
          <SelectItem value="1099">1099 Forms</SelectItem>
          <SelectItem value="receipts">Receipts</SelectItem>
          <SelectItem value="statements">Bank Statements</SelectItem>
        </SelectContent>
      </Select>

      <div className="border-2 border-dashed rounded-lg p-8 text-center mb-4">
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-sm">Click to upload or drag and drop</p>
          <p className="text-xs text-gray-500">PDF, JPG, PNG, DOCX (max 10MB)</p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 mb-4">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFile(i)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={uploadFiles}
        disabled={uploading || files.length === 0}
        className="w-full"
      >
        {uploading ? 'Uploading...' : 'Upload Documents'}
      </Button>
    </Card>
  );
}
