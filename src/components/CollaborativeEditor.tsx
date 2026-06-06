import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MessageCircle, History, Save, Eye, Edit3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  cursor: { line: number; column: number } | null;
  isActive: boolean;
  color: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  line: number;
  timestamp: string;
  resolved: boolean;
}

interface Version {
  id: string;
  content: string;
  timestamp: string;
  author: string;
  changes: string;
}

interface CollaborativeEditorProps {
  documentId: string;
  documentName: string;
  currentUser: string;
  onSave?: (content: string) => void;
}

export default function CollaborativeEditor({ 
  documentId, 
  documentName, 
  currentUser,
  onSave 
}: CollaborativeEditorProps) {
  const [content, setContent] = useState('');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  useEffect(() => {
    loadDocument();
    setupRealtimeSubscription();
    return () => {
      // Cleanup subscription
    };
  }, [documentId]);

  const loadDocument = async () => {
    // Mock data - in real app, load from Supabase
    setContent(`# ${documentName}

## Tax Form 1040 - Individual Income Tax Return

**Taxpayer Information:**
- Name: John Doe
- SSN: XXX-XX-XXXX
- Address: 123 Main St, City, State 12345

**Filing Status:** Single

**Income:**
- Wages, salaries, tips: $50,000
- Interest income: $500
- Total Income: $50,500

**Deductions:**
- Standard deduction: $12,950
- Taxable income: $37,550

**Tax Calculation:**
- Tax liability: $4,200
- Federal tax withheld: $4,500
- Refund due: $300`);

    setCollaborators([
      {
        id: '1',
        name: 'Tax Professional',
        email: 'taxpro@example.com',
        cursor: { line: 5, column: 10 },
        isActive: true,
        color: colors[0]
      },
      {
        id: '2',
        name: 'Client',
        email: 'client@example.com',
        cursor: null,
        isActive: false,
        color: colors[1]
      }
    ]);

    setComments([
      {
        id: '1',
        userId: '1',
        userName: 'Tax Professional',
        content: 'Please verify the SSN is correct',
        line: 6,
        timestamp: '2024-01-15 10:30:00',
        resolved: false
      }
    ]);

    setVersions([
      {
        id: '1',
        content: 'Initial document creation',
        timestamp: '2024-01-15 09:00:00',
        author: 'Tax Professional',
        changes: 'Created document template'
      },
      {
        id: '2',
        content: 'Added taxpayer information',
        timestamp: '2024-01-15 10:15:00',
        author: 'Client',
        changes: 'Updated personal details and income'
      }
    ]);
  };

  const setupRealtimeSubscription = () => {
    // In real app, subscribe to document changes
    const channel = supabase
      .channel(`document:${documentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'document_edits' },
        (payload) => {
          // Handle real-time updates
          console.log('Document updated:', payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // In real app, broadcast changes to other collaborators
    broadcastChange(newContent);
  };

  const broadcastChange = (newContent: string) => {
    // Simulate real-time collaboration
    console.log('Broadcasting change:', newContent);
  };

  const handleSave = () => {
    const newVersion: Version = {
      id: Date.now().toString(),
      content: content,
      timestamp: new Date().toLocaleString(),
      author: currentUser,
      changes: 'Updated document content'
    };
    setVersions(prev => [newVersion, ...prev]);
    
    if (onSave) {
      onSave(content);
    }
  };

  const addComment = () => {
    if (!newComment.trim() || selectedLine === null) return;

    const comment: Comment = {
      id: Date.now().toString(),
      userId: '3',
      userName: currentUser,
      content: newComment,
      line: selectedLine,
      timestamp: new Date().toLocaleString(),
      resolved: false
    };

    setComments(prev => [...prev, comment]);
    setNewComment('');
    setSelectedLine(null);
  };

  const resolveComment = (commentId: string) => {
    setComments(prev => prev.map(comment => 
      comment.id === commentId 
        ? { ...comment, resolved: true }
        : comment
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header with collaborators */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold">{documentName}</h2>
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-gray-500" />
            <div className="flex -space-x-2">
              {collaborators.map(collaborator => (
                <div key={collaborator.id} className="relative">
                  <Avatar className="h-8 w-8 border-2 border-white">
                    <AvatarFallback 
                      style={{ backgroundColor: collaborator.color }}
                      className="text-white text-xs"
                    >
                      {collaborator.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {collaborator.isActive && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <Eye className="h-4 w-4 mr-1" /> : <Edit3 className="h-4 w-4 mr-1" />}
            {isEditing ? 'Preview' : 'Edit'}
          </Button>
          <Button onClick={handleSave} size="sm">
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              {isEditing ? (
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="min-h-[600px] border-0 resize-none font-mono text-sm"
                  placeholder="Start editing your document..."
                />
              ) : (
                <div className="p-6 min-h-[600px] whitespace-pre-wrap font-mono text-sm">
                  {content}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Tabs defaultValue="comments" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Comments ({comments.filter(c => !c.resolved).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Add Comment */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="text-sm"
                      rows={2}
                    />
                    <Button 
                      size="sm" 
                      onClick={addComment}
                      disabled={!newComment.trim()}
                      className="w-full"
                    >
                      Add Comment
                    </Button>
                  </div>

                  {/* Comments List */}
                  {comments.map(comment => (
                    <div key={comment.id} className={`p-3 rounded-lg border ${comment.resolved ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {comment.userName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{comment.userName}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Line {comment.line}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{comment.content}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{comment.timestamp}</span>
                        {!comment.resolved && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => resolveComment(comment.id)}
                            className="text-xs h-6"
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <History className="h-4 w-4 mr-2" />
                    Version History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {versions.map(version => (
                    <div key={version.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{version.author}</span>
                        <span className="text-xs text-gray-500">{version.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-700">{version.changes}</p>
                      <Button size="sm" variant="outline" className="mt-2 text-xs h-6">
                        Restore
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}