import { useState, useEffect, useCallback } from 'react';
import { Share2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DocumentSharingManagerProps {
  documentId: string;
  documentName: string;
  onClose: () => void;
}

interface ProfessionalRow {
  id: string;
  name: string;
  status?: string;
  [k: string]: any;
}

interface ShareEntry {
  professional_id: string;
  permission: 'view' | 'edit';
  status: 'pending' | 'viewed' | 'revoked';
  shared_at: any;
  shared_by: string;
  professional_name?: string;
}

export default function DocumentSharingManager({
  documentId,
  documentName,
  onClose,
}: DocumentSharingManagerProps) {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [selectedPro, setSelectedPro] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(false);

  const loadProfessionals = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'professionals'),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      const rows: ProfessionalRow[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ProfessionalRow, 'id'>),
      }));
      setProfessionals(rows);
    } catch (err) {
      console.error('Failed to load professionals:', err);
    }
  }, []);

  const loadShares = useCallback(async () => {
    try {
      const docRef = doc(db, 'client_documents', documentId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        setShares([]);
        return;
      }
      const data = snap.data() as any;
      const raw: ShareEntry[] = Array.isArray(data.shared_with)
        ? data.shared_with
        : [];

      // Hydrate professional names for display (sequential, small N expected).
      const hydrated = await Promise.all(
        raw.map(async (s) => {
          try {
            const pSnap = await getDoc(doc(db, 'professionals', s.professional_id));
            const name = pSnap.exists()
              ? ((pSnap.data() as any).name as string) || 'Professional'
              : 'Professional';
            return { ...s, professional_name: name };
          } catch {
            return { ...s, professional_name: 'Professional' };
          }
        })
      );
      setShares(hydrated);
    } catch (err) {
      console.error('Failed to load shares:', err);
      setShares([]);
    }
  }, [documentId]);

  useEffect(() => {
    loadProfessionals();
    loadShares();
  }, [loadProfessionals, loadShares]);

  const shareDocument = async () => {
    if (!selectedPro || !user) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'client_documents', documentId);

      // Build the entry. NOTE: serverTimestamp() is NOT supported inside an
      // arrayUnion payload, so we use a client-side ISO timestamp here. The
      // top-level `professional_id` field IS the canonical "who can read"
      // signal that our Firestore rules enforce.
      const entry: ShareEntry = {
        professional_id: selectedPro,
        permission,
        status: 'pending',
        shared_at: new Date().toISOString(),
        shared_by: user.uid,
      };

      await updateDoc(docRef, {
        shared_with: arrayUnion(entry),
        // Also set/refresh the primary professional_id so the rule
        // `resource.data.professional_id == request.auth.uid` matches.
        professional_id: selectedPro,
        updated_at: serverTimestamp(),
      });

      toast.success('Document shared successfully');
      setSelectedPro('');
      await loadShares();
    } catch (error: any) {
      console.error('Failed to share document:', error);
      toast.error('Failed to share document');
    } finally {
      setLoading(false);
    }
  };

  const revokeShare = async (share: ShareEntry) => {
    try {
      const docRef = doc(db, 'client_documents', documentId);

      // arrayRemove needs the EXACT object as it was stored. We strip
      // `professional_name` (added client-side for display) before removing.
      const { professional_name, ...stored } = share;

      await updateDoc(docRef, {
        shared_with: arrayRemove(stored),
        updated_at: serverTimestamp(),
      });

      // If we just revoked the entry that matches the top-level
      // professional_id, clear it so the pro loses read access via rules too.
      const docSnap = await getDoc(docRef);
      const data = docSnap.data() as any;
      const stillShared: ShareEntry[] = Array.isArray(data?.shared_with)
        ? data.shared_with
        : [];
      if (
        data?.professional_id === share.professional_id &&
        !stillShared.some((s) => s.professional_id === share.professional_id)
      ) {
        await updateDoc(docRef, { professional_id: null });
      }

      toast.success('Access revoked');
      await loadShares();
    } catch (err) {
      console.error('Failed to revoke share:', err);
      toast.error('Failed to revoke access');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share: {documentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-medium">Share with Professional</h4>
            <div className="flex gap-2">
              <Select value={selectedPro} onValueChange={setSelectedPro}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select professional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>
                      {pro.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={permission}
                onValueChange={(v) => setPermission(v as 'view' | 'edit')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={shareDocument} disabled={loading || !selectedPro}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Shared With</h4>
            {shares.length === 0 ? (
              <p className="text-sm text-gray-500">
                Not shared with anyone yet
              </p>
            ) : (
              shares.map((share) => (
                <div
                  key={`${share.professional_id}-${share.shared_at}`}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">{share.professional_name}</p>
                      <div className="flex gap-2 text-xs text-gray-500">
                        <Badge variant="outline">{share.permission}</Badge>
                        <Badge
                          variant={
                            share.status === 'viewed' ? 'default' : 'secondary'
                          }
                        >
                          {share.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeShare(share)}
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
