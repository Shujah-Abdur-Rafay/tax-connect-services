import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Account recovery / deactivation status — backed by Firestore.
 * Document path: user_account_status/{userId}
 */
export const accountRecoveryService = {
  async checkAccountStatus(userId: string) {
    try {
      if (!userId) return null;
      const ref = doc(db, 'user_account_status', userId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return { user_id: userId, ...snap.data() } as Record<string, unknown>;
    } catch (error) {
      console.error('Error checking account status:', error);
      return null;
    }
  },

  async recoverAccount(userId: string) {
    try {
      if (!userId) throw new Error('Missing userId');
      const ref = doc(db, 'user_account_status', userId);
      const data = {
        user_id: userId,
        status: 'active',
        deactivation_date: null,
        scheduled_deletion_date: null,
        can_recover: true,
        updated_at: serverTimestamp(),
      };
      await setDoc(ref, data, { merge: true });
      return { success: true, data };
    } catch (error) {
      console.error('Error recovering account:', error);
      throw error;
    }
  },

  isWithinGracePeriod(scheduledDeletionDate: string) {
    const deletionDate = new Date(scheduledDeletionDate);
    const now = new Date();
    return now < deletionDate;
  },

  getDaysUntilDeletion(scheduledDeletionDate: string) {
    const deletionDate = new Date(scheduledDeletionDate);
    const now = new Date();
    const diffTime = deletionDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  },
};
