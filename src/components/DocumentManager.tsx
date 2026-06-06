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
  }, [conversationId]);

  const loadDocuments = async () => {
    // Mock data - in real app, load from Supabase
    const mockDocs: Document[] = [
      {
        id: '1',
        name: '2023_Tax_Return_v2.pdf',
        category: 'Tax Returns',
        version: 2,
        size: '2.4 MB',
        uploadedAt: '2024-01-15',
        uploadedBy: 'John Doe',
        isEncrypted: true,
        signatures: ['John Doe'],
        collaborators: ['John Doe', 'Tax Pro']
      },
      {
        id: '2',
        name: 'Business_Expenses_Q1.xlsx',
        category: 'Business Records',
        version: 1,
        size: '1.2 MB',
        uploadedAt: '2024-01-10',
        uploadedBy: 'Tax Pro',
        isEncrypted: false,
        signatures: [],
        collaborators: ['Tax Pro']
      }
    ];
    setDocuments(mockDocs);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storagePath = `tax-documents/${conversationId}/${Date.now()}_${file.name}`;
      const result = await uploadFile(file, storagePath);

      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        category,
        version: 1,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        uploadedAt: new Date().toISOString().split('T')[0],
        uploadedBy: currentUser,
        isEncrypted: category === 'Tax Returns' || category === 'Legal Documents',
        signatures: [],
        collaborators: [currentUser]
      };

      setDocuments(prev => [...prev, newDoc]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };


  const handleSignDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId 
        ? { ...doc, signatures: [...doc.signatures, currentUser] }
        : doc
    ));
  };

  const handleCreateFromTemplate = (template: any) => {
    const newDoc: Document = {
      id: Date.now().toString(),
      name: template.name,
      category: template.category,
      version: 1,
      size: '0.5 MB',
      uploadedAt: new Date().toISOString().split('T')[0],
      uploadedBy: currentUser,
      isEncrypted: false,
      signatures: [],
      collaborators: [currentUser]
    };
    setDocuments(prev => [...prev, newDoc]);
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