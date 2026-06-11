import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, MessageCircle, Users, Plus, Archive } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToUserConversations } from '@/services/messagingService';
import { relativeTime } from '@/services/memberStatsService';

interface Conversation {
  id: string;
  title: string;
  type: 'direct' | 'group' | 'case';
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  caseId?: string;
  isActive: boolean;
}

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
  activeConversationId?: string;
}

export default function ConversationList({ onSelectConversation, activeConversationId }: ConversationListProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'case'>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Live conversations from Firestore for the signed-in user.
  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      return;
    }
    const unsub = subscribeToUserConversations(user.uid, (list) => {
      setConversations(
        list.map((c) => {
          const isPro = c.professionalId === user.uid;
          return {
            id: c.id,
            title: c.subject || (isPro ? c.clientName : c.professionalName) || 'Conversation',
            type: 'direct' as const,
            participants: c.participants || [],
            lastMessage: c.lastMessage || 'No messages yet',
            lastMessageAt: relativeTime(c.lastMessageAt ? Date.parse(c.lastMessageAt) : null),
            unreadCount: (c.unreadFor && c.unreadFor[user.uid]) || 0,
            isActive: true,
          };
        }),
      );
    });
    return () => unsub();
  }, [user?.uid]);

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filter === 'all' || conv.type === filter;
    return matchesSearch && matchesFilter && conv.isActive;
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messages
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'direct', 'group', 'case'] as const).map((filterType) => (
              <Button
                key={filterType}
                variant={filter === filterType ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(filterType)}
                className="capitalize"
              >
                {filterType}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-4 cursor-pointer hover:bg-gray-50 border-b transition-colors ${
                activeConversationId === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
              onClick={() => onSelectConversation(conversation)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {conversation.type === 'group' ? <Users className="h-5 w-5" /> : 
                       conversation.title.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{conversation.title}</h4>
                      {conversation.type === 'case' && (
                        <Badge variant="secondary" className="text-xs">Case</Badge>
                      )}
                      {conversation.type === 'group' && (
                        <Badge variant="outline" className="text-xs">Group</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{conversation.lastMessageAt}</span>
                      {conversation.participants.length > 1 && (
                        <span className="text-xs text-gray-500">
                          {conversation.participants.length} participants
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {conversation.unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {conversation.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}