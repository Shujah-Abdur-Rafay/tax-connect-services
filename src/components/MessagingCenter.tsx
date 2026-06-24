import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MessageCircle,
  Search,
  Send,
  Paperclip,
  Users,
  Inbox,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Conversation,
  ChatMessage,
  subscribeToUserConversations,
  subscribeToMessages,
  sendMessage as sendMessageToConversation,
  markConversationRead,
} from '@/services/messagingService';
import { uploadFile as uploadToStorage } from '@/services/firebaseStorageService';

interface MessagingCenterProps {
  currentUserId: string;
}

const formatRelativeTime = (iso: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const MessagingCenter: React.FC<MessagingCenterProps> = ({ currentUserId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );

  // Subscribe to the current user's conversations in real time.
  useEffect(() => {
    if (!currentUserId) return;
    const unsub = subscribeToUserConversations(currentUserId, (list) => {
      setConversations(list);

      // If the URL specifies a conversation, prefer that one.
      const requested = searchParams.get('conversation');
      if (requested && list.some((c) => c.id === requested)) {
        setActiveId(requested);
      } else if (!activeId && list.length > 0) {
        setActiveId(list[0].id);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Subscribe to messages of the active conversation.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    const unsub = subscribeToMessages(activeId, (list) => {
      setMessages(list);
      setLoadingMessages(false);
    });
    return () => unsub();
  }, [activeId]);

  // Mark the active conversation as read when opened.
  useEffect(() => {
    if (activeId && currentUserId) {
      markConversationRead(activeId, currentUserId);
    }
  }, [activeId, currentUserId, messages.length]);

  // Auto-scroll to the bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const other =
        c.clientId === currentUserId ? c.professionalName : c.clientName;
      return (
        other.toLowerCase().includes(q) ||
        (c.subject || '').toLowerCase().includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, search, currentUserId]);

  const getOtherParty = (conv: Conversation): string => {
    return conv.clientId === currentUserId ? conv.professionalName : conv.clientName;
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveId(conv.id);
    setSearchParams({ tab: 'messages', conversation: conv.id }, { replace: true });
  };

  const handleSend = async () => {
    if (!draft.trim() || !activeConversation || !user) return;
    const content = draft.trim();
    setDraft('');
    try {
      await sendMessageToConversation({
        conversationId: activeConversation.id,
        senderId: currentUserId,
        senderName: user.name || 'User',
        content,
        type: 'text',
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      toast({
        title: 'Message failed',
        description: 'Could not deliver your message. Please try again.',
        variant: 'destructive',
      });
      setDraft(content);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeConversation || !user) return;
    setIsUploading(true);
    try {
      const path = `messages/${activeConversation.id}/${Date.now()}-${file.name}`;
      const result = await uploadToStorage(file, path);
      await sendMessageToConversation({
        conversationId: activeConversation.id,
        senderId: currentUserId,
        senderName: user.name || 'User',
        content: file.name,
        type: 'file',
        fileName: file.name,
        fileUrl: result.url,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      });
    } catch (err) {
      console.error('File upload failed:', err);
      toast({
        title: 'Upload failed',
        description: 'Could not attach your file. Please try a different file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const renderEmptyState = () => (
    <Card className="h-full min-h-[400px] flex items-center justify-center">
      <CardContent className="text-center py-12">
        <Inbox className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
        <p className="text-gray-600 max-w-sm mx-auto">
          When you contact a tax professional from their listing, your conversation
          will appear here.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* Conversation list */}
      <Card className="lg:col-span-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5" />
            Messages
            {conversations.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {conversations.length}
              </Badge>
            )}
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              {conversations.length === 0
                ? 'No conversations yet. Contact a tax professional to start one.'
                : 'No conversations match your search.'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conv) => {
                const other = getOtherParty(conv);
                const unread = conv.unreadFor?.[currentUserId] || 0;
                const isActive = conv.id === activeId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                      isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback>
                        {other.charAt(0).toUpperCase() || <Users className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{other}</p>
                        <span className="text-[10px] text-gray-500 flex-shrink-0">
                          {formatRelativeTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      {conv.subject && (
                        <p className="text-xs text-gray-500 truncate">{conv.subject}</p>
                      )}
                      <p className="text-xs text-gray-600 truncate mt-0.5">
                        {conv.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <Badge variant="destructive" className="ml-1 flex-shrink-0">
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message thread */}
      <div className="lg:col-span-2 h-full">
        {!activeConversation ? (
          renderEmptyState()
        ) : (
          <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {getOtherParty(activeConversation)}
                  </CardTitle>
                  {activeConversation.subject && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activeConversation.subject}
                    </p>
                  )}
                </div>
                {activeConversation.serviceType && (
                  <Badge variant="outline" className="capitalize">
                    {activeConversation.serviceType.replace(/-/g, ' ')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {loadingMessages && messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">
                    Loading messages...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">
                    No messages yet. Start the conversation below.
                  </p>
                ) : (
                  messages.map((msg) => {
                    if (msg.type === 'system') {
                      return (
                        <div
                          key={msg.id}
                          className="mx-auto max-w-md text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 whitespace-pre-wrap text-center"
                        >
                          {msg.content}
                        </div>
                      );
                    }
                    const isOwn = msg.senderId === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-blue-600 text-white rounded-br-sm'
                              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                          }`}
                        >
                          {!isOwn && (
                            <p className="text-[10px] font-semibold opacity-75 mb-0.5">
                              {msg.senderName}
                            </p>
                          )}
                          {msg.type === 'file' && msg.fileUrl ? (
                            <a
                              href={msg.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-sm underline ${
                                isOwn ? 'text-white' : 'text-blue-600'
                              }`}
                            >
                              📎 {msg.fileName || msg.content}
                              {msg.fileSize ? ` (${msg.fileSize})` : ''}
                            </a>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}
                          <p
                            className={`text-[10px] mt-1 ${
                              isOwn ? 'text-blue-100' : 'text-gray-500'
                            }`}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t p-3 bg-white">
                <div className="flex items-end gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt,.csv"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={isUploading}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!draft.trim() || isUploading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
                {isUploading && (
                  <p className="text-xs text-gray-500 mt-2">Uploading attachment...</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MessagingCenter;
