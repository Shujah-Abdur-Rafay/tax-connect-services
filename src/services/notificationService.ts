import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, Timestamp } from 'firebase/firestore';

export interface Notification {
  id?: string;
  userId: string;
  type: 'subscription' | 'payment' | 'message' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  metadata?: {
    subscriptionId?: string;
    amount?: number;
    status?: string;
    [key: string]: any;
  };
}

export const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      ...notification,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const markAsRead = async (notificationId: string) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};
