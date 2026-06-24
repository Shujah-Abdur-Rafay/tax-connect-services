import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { uploadFile as uploadToStorage } from '@/services/firebaseStorageService';
import { useAuth } from './AuthContext';
import {
  Conversation as FsConversation,
  subscribeToUserConversations,
  sendMessage as fsSendMessage,
} from '@/services/messagingService';

/**
 * Lightweight wrapper around the Firestore messaging service so legacy
 * components (e.g. MessageNotifications) can read live unread counts and
 * conversation summaries without re-implementing subscription logic.
 */

interface ConversationSummary {
  id: string;
  clientId: string;
  professionalId: string;
  otherPartyName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface MessagingContextType {
  conversations: ConversationSummary[];
  totalUnreadCount: number;
  sendMessage: (
    conversationId: string,
    content: string,
    type?: 'text' | 'file',
    fileName?: string,
    fileUrl?: string,
  ) => Promise<void>;
  uploadFile: (file: File) => Promise<string>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

const summarize = (
  fsConv: FsConversation,
  currentUserId: string,
): ConversationSummary => {
  const isClient = fsConv.clientId === currentUserId;
  return {
    id: fsConv.id,
    clientId: fsConv.clientId,
    professionalId: fsConv.professionalId,
    otherPartyName: isClient ? fsConv.professionalName : fsConv.clientName,
    lastMessage: fsConv.lastMessage,
    lastMessageAt: fsConv.lastMessageAt,
    unreadCount: fsConv.unreadFor?.[currentUserId] || 0,
  };
};

export const MessagingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      return;
    }
    const unsub = subscribeToUserConversations(user.uid, (list) => {
      setConversations(list.map((c) => summarize(c, user.uid)));
    });
    return () => unsub();
  }, [user?.uid]);

  const sendMessage = async (
    conversationId: string,
    content: string,
    type: 'text' | 'file' = 'text',
    fileName?: string,
    fileUrl?: string,
  ) => {
    if (!user) return;
    await fsSendMessage({
      conversationId,
      senderId: user.uid,
      senderName: user.name || 'User',
      content,
      type,
      fileName,
      fileUrl,
    });
  };

  const uploadFile = async (file: File): Promise<string> => {
    const storagePath = `messages/${Date.now()}-${file.name}`;
    const result = await uploadToStorage(file, storagePath);
    return result.url;
  };

  const totalUnreadCount = conversations.reduce(
    (total, conv) => total + conv.unreadCount,
    0,
  );

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        totalUnreadCount,
        sendMessage,
        uploadFile,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider');
  }
  return context;
};
