import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, MoreVertical, Reply, Edit, Trash2, Download, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'file' | 'system';
  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  replyToId?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

interface MessageThreadProps {
  conversationId: string;
  conversationTitle: string;
  participants: string[];
  currentUserId: string;
  onSendMessage: (content: string, type?: 'text' | 'file', fileName?: string, fileUrl?: string) => void;
  onUploadFile: (file: File) => Promise<string>;
}

export default function MessageThread({ 
  conversationId, 
  conversationTitle, 
  participants,
  currentUserId,
  onSendMessage,
  onUploadFile 
}: MessageThreadProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Mock messages
    setMessages([
      {
        id: '1',
        senderId: 'user1',
        senderName: 'Sarah Johnson',
        content: 'Hi, I need help with my business tax return.',
        messageType: 'text',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        isEdited: false,
        status: 'read'
      },
      {
        id: '2',
        senderId: currentUserId,
        senderName: 'You',
        content: 'I\'d be happy to help! Could you share your business documents?',
        messageType: 'text',
        createdAt: new Date(Date.now() - 3000000).toISOString(),
        isEdited: false,
        status: 'read'
      },
      {
        id: '3',
        senderId: 'user1',
        senderName: 'Sarah Johnson',
        content: 'business-expenses-2024.pdf',
        messageType: 'file',
        fileName: 'business-expenses-2024.pdf',
        fileSize: '2.3 MB',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        isEdited: false,
        status: 'read'
      }
    ]);
  }, [conversationId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUserId,
      senderName: 'You',
      content: message,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      isEdited: false,
      status: 'sending',
      replyToId: replyToMessage?.id
    };

    setMessages(prev => [...prev, newMessage]);
    setMessage('');
    setReplyToMessage(null);

    try {
      await onSendMessage(message, 'text');
      // Update message status to sent
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id ? { ...msg, status: 'sent' } : msg
      ));
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileUrl = await onUploadFile(file);
      
      const fileMessage: Message = {
        id: Date.now().toString(),
        senderId: currentUserId,
        senderName: 'You',
        content: file.name,
        messageType: 'file',
        fileName: file.name,
        fileUrl,
        fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        createdAt: new Date().toISOString(),
        isEdited: false,
        status: 'sending'
      };

      setMessages(prev => [...prev, fileMessage]);
      await onSendMessage(file.name, 'file', file.name, fileUrl);
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending': return '⏳';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '👁';
      default: return '';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>{conversationTitle}</span>
          <Badge variant="outline">{participants.length} participants</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 max-h-96">
          {messages.map((msg) => (
            <div key={msg.id} className="group">
              {msg.replyToId && (
                <div className="ml-12 mb-2 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
                  <p className="text-xs text-gray-600">Replying to previous message</p>
                </div>
              )}
              
              <div className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${msg.senderId === currentUserId ? 'order-2' : ''}`}>
                  <div className={`p-3 rounded-lg ${
                    msg.senderId === currentUserId 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100'
                  }`}>
                    {msg.messageType === 'file' ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-medium">{msg.fileName}</p>
                          <p className="text-xs opacity-70">{msg.fileSize}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs opacity-70">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                        {msg.isEdited && ' (edited)'}
                      </p>
                      {msg.senderId === currentUserId && (
                        <span className="text-xs opacity-70">{getStatusIcon(msg.status)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setReplyToMessage(msg)}>
                      <Reply className="h-3 w-3" />
                    </Button>
                    
                    {msg.senderId === currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setEditingMessageId(msg.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                
                {msg.senderId !== currentUserId && (
                  <Avatar className="h-8 w-8 order-1 mr-2">
                    <AvatarFallback className="text-xs">
                      {msg.senderName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          ))}
          
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Preview */}
        {replyToMessage && (
          <div className="mb-2 p-2 bg-blue-50 rounded border-l-4 border-blue-500 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600">Replying to {replyToMessage.senderName}</p>
              <p className="text-sm truncate">{replyToMessage.content}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setReplyToMessage(null)}>
              ×
            </Button>
          </div>
        )}

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1"
          />
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Button onClick={handleSendMessage} disabled={!message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}