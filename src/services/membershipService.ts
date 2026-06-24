import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const updateUserMembership = async (userId: string, membershipLevel: string) => {
  if (!db) throw new Error('Firestore not initialized');
  
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      membershipLevel,
      membershipUpdatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating membership:', error);
    throw error;
  }
};

export const getUserMembership = async (userId: string) => {
  if (!db) throw new Error('Firestore not initialized');
  
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data().membershipLevel || 'Listing';
    }
    
    return 'Listing';
  } catch (error) {
    console.error('Error getting membership:', error);
    return 'Listing';
  }
};

// Update Gerald Shava to Professional membership
export const upgradeGeraldShava = async () => {
  if (!db) throw new Error('Firestore not initialized');
  
  try {
    // Find Gerald Shava's user document by email
    const usersRef = doc(db, 'users', 'gerald-shava-uid'); // Replace with actual UID
    await updateDoc(usersRef, {
      membershipLevel: 'Professional',
      membershipUpdatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error upgrading Gerald Shava:', error);
    throw error;
  }
};
