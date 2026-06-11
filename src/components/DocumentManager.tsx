import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Upload, Download, Edit, Share2, Lock, Clock, Signature, Users, GitBranch } from 'lucide-react';
import { uploadFile } from '@/services/firebaseStorageService';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc as fsDoc,
  updateDoc,
  query,
  where,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import DigitalSignature from './DigitalSignature';
import CollaborativeEditor from './CollaborativeEditor';
import { ApprovalWorkflow } from './ApprovalWorkflow';

interface Document {
  id: string;
  name: string;
  category: string;
  version: number;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  isEncrypted: boolean;
  signatures: string[];
  collaborators: string[];
}

interface DocumentManagerProps {
  conversationId: string;
  currentUser: string;
}

export default function DocumentManager({ conversationId, currentUser }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

  const categories = [
    'Tax Returns', 'W-2 Forms', 'Business Records', 'Receipts', 
    'Legal Documents', 'Templates', 'Other'
  ];

  const templates = [
    { name: '1040 Tax Return Template', category: 'Tax Returns' },
    { name: 'Business Expense Report', category: 'Business Records' },
    { name: 'Receipt Organization Sheet', category: 'Receipts' },
    { name: 'Tax Document Checklist', category: 'Templates' }
  ];

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 KB';
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const mapDoc = (id: string, data: any): Document => {
    const uploadedAt =
      data.uploaded_at instanceof Timestamp
        ? data.uploaded_at.toDate().toISOString().split('T')[0]
        : typeof data.uploaded_at === 'string'
        ? data.uploaded_at.split('T')[0]
        : new Date().toISOString().split('T')[0];
    return {
      id,
      name: data.file_name || 'Document',
      category: data.category || 'Other',
      version: Number(data.version || 1),
      size: typeof data.file_size === 'number' ? formatBytes(data.file_size) : data.size || '—',
      uploadedAt,
      uploadedBy: data.uploaded_by || 'You',
      isEncrypted: data.is_encrypted === true,
      signatures: Array.isArray(data.signatures) ? data.signatures : [],
      collaborators: Array.isArray(data.collaborators) ? data.collaborators : [],
    };
  };

  // Real documents from Firestore `client_documents`, scoped to this owner.
  const loadDocuments = async () => {
    if (!db || !conversationId) {
      setDocuments([]);
      return;
    }
    try {
      const snap = await getDocs(
        query(collection(db, 'client_documents'), where('owner_id', '==', conversationId)),
      );
      const docs = snap.docs
        .map((d) => mapDoc(d.id, d.data()))
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      setDocuments(docs);
    } catch (err) {
      console.warn('[DocumentManager] failed to load documents:', err);
      setDocuments([]);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storagePath = `tax-documents/${conversationId}/${Date.now()}_${file.name}`;
      const result = await uploadFile(file, storagePath);

      // Persist a real record in Firestore `client_documents` (keys required by
      // the security rule: owner_id, file_name, storage_path, status, uploaded_at).
      await addDoc(collection(db, 'client_documents'), {
        owner_id: conversationId,
        file_name: file.name,
        storage_path: result.path,
        download_url: result.url,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
        category,
        version: 1,
        uploaded_by: currentUser,
        is_encrypted: category === 'Tax Returns' || category === 'Legal Documents',
        signatures: [],
        collaborators: [currentUser],
        status: 'uploaded',
        uploaded_at: serverTimestamp(),
      });

      await loadDocuments();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };


  const handleSignDocument = async (docId: string) => {
    // Optimistic UI update…
    setDocuments(prev => prev.map(doc =>
      doc.id === docId
        ? { ...doc, signatures: [...doc.signatures, currentUser] }
        : doc
    ));
    // …then persist the signature.
    try {
      await updateDoc(fsDoc(db, 'client_documents', docId), {
        signatures: arrayUnion(currentUser),
        updated_at: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[DocumentManager] failed to persist signature:', err);
    }
  };

  const handleCreateFromTemplate = async (template: any) => {
    try {
      await addDoc(collection(db, 'client_documents'), {
        owner_id: conversationId,
        file_name: template.name,
        storage_path: '',
        category: template.category,
        version: 1,
        uploaded_by: currentUser,
        is_encrypted: false,
        signatures: [],
        collaborators: [currentUser],
        status: 'template',
        uploaded_at: serverTimestamp(),
      });
      await loadDocuments();
    } catch (err) {
      console.error('[DocumentManager] failed to create from template:', err);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          {filteredDocuments.map(doc => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-medium">{doc.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Badge variant="secondary">{doc.category}</Badge>
                      <span>v{doc.version}</span>
                      <span>{doc.size}</span>
                      {doc.isEncrypted && <Lock className="h-3 w-3" />}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-400 mt-1">
                      <span>By {doc.uploadedBy}</span>
                      <span>•</span>
                      <span>{doc.uploadedAt}</span>
                      {doc.signatures.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center">
                            <Signature className="h-3 w-3 mr-1" />
                            {doc.signatures.length} signature(s)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-1" />
                        Collaborate
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Collaborative Editor</DialogTitle>
                      </DialogHeader>
                      <CollaborativeEditor
                        documentId={doc.id}
                        documentName={doc.name}
                        currentUser={currentUser}
                        onSave={(content) => console.log('Document saved:', content)}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <GitBranch className="h-4 w-4 mr-1" />
                        Workflow
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Approval Workflow</DialogTitle>
                      </DialogHeader>
                      <ApprovalWorkflow
                        documentId={doc.id}
                        documentName={doc.name}
                        currentUser={currentUser}
                        onApprovalComplete={() => console.log('Workflow completed')}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Signature className="h-4 w-4 mr-1" />
                        Sign
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Digital Signature</DialogTitle>
                      </DialogHeader>
                      <DigitalSignature
                        documentId={doc.id}
                        documentName={doc.name}
                        onSign={(signature) => handleSignDocument(doc.id)}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {templates.map((template, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-green-500" />
                  <div>
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                </div>
                <Button onClick={() => handleCreateFromTemplate(template)}>
                  Use Template
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          {categories.map(category => (
            <Card key={category} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{category}</h3>
                  <p className="text-sm text-gray-500">Upload documents for {category.toLowerCase()}</p>
                </div>
                <div>
                  <input
                    type="file"
                    id={`upload-${category}`}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, category)}
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.png"
                  />
                  <Button
                    onClick={() => document.getElementById(`upload-${category}`)?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}