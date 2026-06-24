import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';

/**
 * Firestore-backed messaging service.
 *
 * Data model:
 *   conversations/{conversationId}
 *     - clientId, clientName, clientEmail
 *     - professionalId, professionalName
 *     - participants: string[]   (uids the conversation is visible to)
 *     - subject, serviceType
 *     - lastMessage, lastMessageAt (server timestamp)
 *     - unreadFor: { [uid: string]: number }
 *     - createdAt (server timestamp)
 *
 *   conversations/{conversationId}/messages/{messageId}
 *     - senderId, senderName
 *     - content
 *     - type: 'text' | 'file' | 'system'
 *     - fileName?, fileUrl?, fileSize?
 *     - createdAt (server timestamp)
 */

export interface Conversation {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  professionalId: string;
  professionalName: string;
  participants: string[];
  subject?: string;
  serviceType?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadFor?: Record<string, number>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'file' | 'system';
  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  createdAt: string;
}

const tsToIso = (value: unknown): string => {
  if (!value) return new Date().toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as any)) {
    return new Date(((value as any).seconds as number) * 1000).toISOString();
  }
  return new Date().toISOString();
};

/**
 * Find an existing conversation between a client and a professional, or create one.
 * Returns the conversationId.
 */
export const findOrCreateConversation = async (params: {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  professionalId: string;
  professionalName: string;
  subject?: string;
  serviceType?: string;
}): Promise<string> => {
  const {
    clientId,
    clientName,
    clientEmail,
    professionalId,
    professionalName,
    subject,
    serviceType,
  } = params;

  // Look for an existing direct conversation between these two participants.
  const convRef = collection(db, 'conversations');
  const q = query(
    convRef,
    where('clientId', '==', clientId),
    where('professionalId', '==', professionalId),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0].id;
  }

  // Create a new conversation.
  const newConv = await addDoc(convRef, {
    clientId,
    clientName,
    clientEmail: clientEmail || null,
    professionalId,
    professionalName,
    participants: [clientId, professionalId],
    subject: subject || null,
    serviceType: serviceType || null,
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    unreadFor: { [professionalId]: 0, [clientId]: 0 },
    createdAt: serverTimestamp(),
  });
  return newConv.id;
};

/**
 * Send a message in a conversation. Also updates the conversation's lastMessage
 * and increments unreadFor counter for the other participant.
 */
export const sendMessage = async (params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type?: 'text' | 'file' | 'system';
  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
}): Promise<string> => {
  const {
    conversationId,
    senderId,
    senderName,
    content,
    type = 'text',
    fileName,
    fileUrl,
    fileSize,
  } = params;

  const msgRef = collection(db, 'conversations', conversationId, 'messages');
  const msg = await addDoc(msgRef, {
    senderId,
    senderName,
    content,
    type,
    fileName: fileName || null,
    fileUrl: fileUrl || null,
    fileSize: fileSize || null,
    createdAt: serverTimestamp(),
  });

  // Update conversation summary + unread counts.
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  const data = convSnap.data() || {};
  const participants: string[] = data.participants || [];
  const unreadFor: Record<string, number> = { ...(data.unreadFor || {}) };
  participants.forEach((uid) => {
    if (uid !== senderId) {
      unreadFor[uid] = (unreadFor[uid] || 0) + 1;
    }
  });

  await updateDoc(convRef, {
    lastMessage:
      type === 'file' ? `📎 ${fileName || 'File attachment'}` : content.slice(0, 200),
    lastMessageAt: serverTimestamp(),
    unreadFor,
  });

  return msg.id;
};

/**
 * Subscribe to all conversations a user participates in. Returns an unsubscribe fn.
 */
export const subscribeToUserConversations = (
  uid: string,
  callback: (conversations: Conversation[]) => void,
): Unsubscribe => {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: Conversation[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          clientId: (data.clientId as string) || '',
          clientName: (data.clientName as string) || 'Client',
          clientEmail: (data.clientEmail as string) || undefined,
          professionalId: (data.professionalId as string) || '',
          professionalName: (data.professionalName as string) || 'Professional',
          participants: (data.participants as string[]) || [],
          subject: (data.subject as string) || undefined,
          serviceType: (data.serviceType as string) || undefined,
          lastMessage: (data.lastMessage as string) || '',
          lastMessageAt: tsToIso(data.lastMessageAt),
          unreadFor: (data.unreadFor as Record<string, number>) || {},
          createdAt: tsToIso(data.createdAt),
        };
      });
      list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      callback(list);
    },
    (error) => {
      console.warn('subscribeToUserConversations error:', error.message);
      callback([]);
    },
  );
};

/**
 * Subscribe to messages within a conversation, ordered by createdAt asc.
 */
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
): Unsubscribe => {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          conversationId,
          senderId: (data.senderId as string) || '',
          senderName: (data.senderName as string) || 'User',
          content: (data.content as string) || '',
          type: ((data.type as string) || 'text') as ChatMessage['type'],
          fileName: (data.fileName as string) || undefined,
          fileUrl: (data.fileUrl as string) || undefined,
          fileSize: (data.fileSize as string) || undefined,
          createdAt: tsToIso(data.createdAt),
        };
      });
      callback(list);
    },
    (error) => {
      console.warn('subscribeToMessages error:', error.message);
      callback([]);
    },
  );
};

/**
 * Clear the unread counter for a user in a conversation.
 */
export const markConversationRead = async (conversationId: string, uid: string) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();
    const unreadFor: Record<string, number> = { ...(data.unreadFor || {}) };
    if (unreadFor[uid]) {
      unreadFor[uid] = 0;
      await updateDoc(convRef, { unreadFor });
    }
  } catch (err) {
    console.warn('markConversationRead failed:', (err as Error).message);
  }
};

/**
 * Create the initial conversation + message that a contact-form submission produces.
 * Returns the conversationId so the caller can deep-link to it.
 */
export const createConversationFromContactSubmission = async (params: {
  clientId: string;
  clientName: string;
  clientEmail: string;
  professionalId: string;
  professionalName: string;
  serviceType?: string;
  message: string;
  phone?: string;
  preferredContact?: string;
}): Promise<string> => {
  const conversationId = await findOrCreateConversation({
    clientId: params.clientId,
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    professionalId: params.professionalId,
    professionalName: params.professionalName,
    subject: params.serviceType ? `Inquiry: ${params.serviceType}` : 'New inquiry',
    serviceType: params.serviceType,
  });

  // Friendly system message with contact details for the professional.
  const systemLines = [
    `New inquiry from ${params.clientName} (${params.clientEmail})`,
    params.phone ? `Phone: ${params.phone}` : null,
    params.serviceType ? `Service: ${params.serviceType}` : null,
    params.preferredContact ? `Preferred contact: ${params.preferredContact}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await sendMessage({
    conversationId,
    senderId: 'system',
    senderName: 'System',
    content: systemLines,
    type: 'system',
  });

  // Client's actual message.
  await sendMessage({
    conversationId,
    senderId: params.clientId,
    senderName: params.clientName,
    content: params.message,
    type: 'text',
  });

  return conversationId;
};
