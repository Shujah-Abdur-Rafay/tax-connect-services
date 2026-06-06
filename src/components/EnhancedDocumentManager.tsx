import { useState, useEffect } from 'react';
import { FileText, Upload, Eye, Trash2, Share2, FolderOpen, Download, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ClientDocumentUpload from './ClientDocumentUpload';
import DocumentPreview from './DocumentPreview';
import DocumentSharingManager from './DocumentSharingManager';
import { toast } from 'sonner';
import { emailNotificationService } from '@/services/emailNotificationService';


export default function EnhancedDocumentManager() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [sharingDoc, setSharingDoc] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-docs');

  useEffect(() => {
    loadDocuments();
  }, [user, activeTab]);

  const loadDocuments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase.from('client_documents').select('*, document_shares(*)');
      
      if (activeTab === 'my-docs') {
        query = query.eq('client_id', user.uid);
      } else if (activeTab === 'shared') {
        query = query.neq('client_id', user.uid);
      }
      
      const { data, error } = await query.order('upload_date', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (doc: any) => {
    if (!confirm('Delete this document?')) return;
    try {
      await supabase.storage.from('tax-documents').remove([doc.storage_path]);
      await supabase.from('client_documents').delete().eq('id', doc.id);
      toast.success('Document deleted');
      loadDocuments();
    } catch (error: any) {
      toast.error('Failed to delete');
    }
  };

  const downloadDoc = async (doc: any) => {
    const { data } = await supabase.storage.from('tax-documents').createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = doc.file_name;
      a.click();
    }
  };

  const filtered = documents.filter(d => {
    const matchesFolder = filter === 'all' || d.folder === filter;
    const matchesSearch = d.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const folders = ['all', ...new Set(documents.map(d => d.folder))];
  const getStatusBadge = (doc: any) => {
    const shares = doc.document_shares || [];
    if (shares.length === 0) return <Badge variant="secondary">Private</Badge>;
    if (shares.some((s: any) => s.status === 'viewed')) return <Badge>Viewed</Badge>;
    return <Badge variant="outline">Shared</Badge>;
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-docs">My Documents</TabsTrigger>
          <TabsTrigger value="shared">Shared with Me</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="my-docs" className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Search documents..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1" />
            <div className="flex gap-2">
              {folders.map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
                  {f}
                </Button>
              ))}
            </div>
          </div>

          {loading ? <p>Loading...</p> : filtered.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">No documents found</Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(doc => (
                <Card key={doc.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">{doc.file_name}</p>
                        <div className="flex gap-2 text-sm text-gray-500">
                          <span>{new Date(doc.upload_date).toLocaleDateString()}</span>
                          <Badge variant="outline">{doc.folder}</Badge>
                          {getStatusBadge(doc)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(doc)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => downloadDoc(doc)}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setSharingDoc(doc)}><Share2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteDocument(doc)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared"><p className="text-center py-8 text-gray-500">Documents shared with you will appear here</p></TabsContent>
        <TabsContent value="upload"><ClientDocumentUpload onUploadComplete={loadDocuments} /></TabsContent>
      </Tabs>

      <DocumentPreview document={selectedDoc} onClose={() => setSelectedDoc(null)} />
      {sharingDoc && <DocumentSharingManager documentId={sharingDoc.id} documentName={sharingDoc.file_name} onClose={() => setSharingDoc(null)} />}
    </div>
  );
}
