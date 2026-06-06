import { useState, useEffect } from 'react';
import { FileText, Eye, Download, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DocumentPreview from './DocumentPreview';
import { toast } from 'sonner';

export default function ProfessionalDocumentViewer() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [user]);

  const loadDocuments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_documents')
        .select('*')
        .eq('professional_id', user.uid)
        .order('upload_date', { ascending: false });
      
      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (docId: string, status: string) => {
    try {
      await supabase.from('client_documents').update({ status }).eq('id', docId);
      toast.success('Status updated');
      loadDocuments();
    } catch (error: any) {
      toast.error('Failed to update status');
    }
  };

  const filtered = documents.filter(d => 
    d.file_name.toLowerCase().includes(search.toLowerCase()) ||
    d.client_id.includes(search)
  );

  const groupedByClient = filtered.reduce((acc, doc) => {
    if (!acc[doc.client_id]) acc[doc.client_id] = [];
    acc[doc.client_id].push(doc);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Client Documents</h3>
        
        <Input
          placeholder="Search by filename or client ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />

        {loading ? (
          <p>Loading...</p>
        ) : Object.keys(groupedByClient).length === 0 ? (
          <p className="text-center text-gray-500 py-8">No client documents yet</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByClient).map(([clientId, docs]) => (
              <div key={clientId} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5" />
                  <h4 className="font-semibold">Client: {clientId.slice(0, 8)}...</h4>
                  <Badge>{docs.length} documents</Badge>
                </div>
                
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-sm">{doc.file_name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(doc.upload_date).toLocaleDateString()} • {doc.folder}
                          </p>
                        </div>
                        <Badge variant={doc.status === 'reviewed' ? 'default' : 'outline'}>
                          {doc.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateStatus(doc.id, doc.status === 'reviewed' ? 'pending' : 'reviewed')}
                        >
                          {doc.status === 'reviewed' ? 'Unmark' : 'Mark Reviewed'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DocumentPreview document={selectedDoc} onClose={() => setSelectedDoc(null)} />
    </div>
  );
}
