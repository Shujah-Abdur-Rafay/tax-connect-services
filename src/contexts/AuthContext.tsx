import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { sendVerificationEmail } from '@/services/emailVerificationService';
import { createProfessionalListing } from '@/services/professionalsService';
import { MembershipLevel } from '@/constants/membershipLevels';


interface User {
  /** Firebase Auth UID. Available as both `id` and `uid` for compatibility. */
  id: string;
  uid: string;
  email: string;
  name: string;
  role: 'client' | 'professional' | 'admin';
  emailVerified: boolean;
  photoURL?: string;
  membershipLevel?: MembershipLevel | string;
}





interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isProfessional: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: 'client' | 'professional') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserProfile: (profileData: Partial<User> & { phone?: string; location?: string; bio?: string; company?: string; title?: string }) => Promise<void>;
}




const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProfessional, setIsProfessional] = useState(false);

  useEffect(() => {
    if (!auth) {
      console.error('Firebase Auth is not initialized');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser && db) {
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData.name || firebaseUser.displayName || 'User',
              role: userData.role || 'client',
              emailVerified: firebaseUser.emailVerified,
              photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
              membershipLevel: userData.membershipLevel || MembershipLevel.DIRECTORY_LISTING

            });
            setIsAdmin(userData.role === 'admin');
            setIsProfessional(userData.role === 'professional');

          } else {
            // User exists in Firebase Auth but not in Firestore - create record
            const newUserData = {
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email,
              role: 'client' as const,
              createdAt: new Date().toISOString(),
              emailVerified: firebaseUser.emailVerified
            };
            
            await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
            
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: newUserData.name,
              role: newUserData.role,
              emailVerified: firebaseUser.emailVerified,
              photoURL: firebaseUser.photoURL || undefined
            });
            setIsAdmin(false);
            setIsProfessional(false);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // If Firestore fails, still set basic user info from Firebase Auth
          setUser({
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            role: 'client',
            emailVerified: firebaseUser.emailVerified,
            photoURL: firebaseUser.photoURL || undefined
          });
          setIsAdmin(false);
          setIsProfessional(false);
        }


      } else {
        setUser(null);
        setIsAdmin(false);
        setIsProfessional(false);
      }
      
      setLoading(false);
    });


    return () => unsubscribe();
  }, []);



  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Please check your Firebase configuration.');
    }
    
    // Simply authenticate - let onAuthStateChanged handle the rest
    await signInWithEmailAndPassword(auth, email, password);
  };





  const register = async (email: string, password: string, name: string, role: 'client' | 'professional') => {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Please check your Firebase configuration.');
    }
    if (!db) {
      throw new Error('Firebase Firestore is not initialized. Please check your Firebase configuration.');
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    
    // Store additional user data in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      name,
      email,
      role,
      // A brand-new professional starts on the free Directory Listing tier so
      // their auto-created public profile is immediately live.
      ...(role === 'professional'
        ? { membershipLevel: MembershipLevel.DIRECTORY_LISTING }
        : {}),
      createdAt: new Date().toISOString(),
      emailVerified: false
    });

    // LAUNCH-CRITICAL: the moment a professional registers, create their free
    // Directory Listing profile + shareable /preparer/{slug} landing page.
    // Best-effort — a failure here must never block account creation (the
    // profileSyncQueue + onboarding will reconcile it on next load).
    if (role === 'professional') {
      try {
        await createProfessionalListing({
          uid: userCredential.user.uid,
          name,
          email,
        });
      } catch (listingErr) {
        console.warn('[register] auto-create professional listing failed (non-fatal):', listingErr);
      }
    }

    // Send verification email for professional accounts. Best-effort — a send
    // failure (e.g. auth/too-many-requests) must never block registration; the
    // user can always resend from the member portal's Email Verification card.
    if (role === 'professional') {
      try {
        await sendVerificationEmail(userCredential.user);
      } catch (verifyErr) {
        console.warn('[register] verification email send failed (non-fatal):', verifyErr);
      }
    }
  };



  const logout = async () => {
    await signOut(auth);
  };

  const refreshUser = async () => {
    if (!firebaseUser || !db) return;
    
    try {
      // Reload Firebase user to get latest data
      await firebaseUser.reload();
      
      // Fetch updated user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: userData.name || firebaseUser.displayName || 'User',
          role: userData.role || 'client',
          emailVerified: firebaseUser.emailVerified,
          photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
          membershipLevel: userData.membershipLevel || MembershipLevel.DIRECTORY_LISTING
        });

        setIsAdmin(userData.role === 'admin');
        setIsProfessional(userData.role === 'professional');
      }

    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };


  const updateUserProfile = async (profileData: Partial<User> & { phone?: string; location?: string; bio?: string; company?: string; title?: string }) => {
    if (!firebaseUser || !db) {
      throw new Error('User not authenticated or database not available');
    }

    try {
      // Update Firebase Auth profile if name or photoURL changed
      if (profileData.name || profileData.photoURL) {
        await updateProfile(firebaseUser, {
          displayName: profileData.name || firebaseUser.displayName,
          photoURL: profileData.photoURL || firebaseUser.photoURL
        });
      }

      // Update Firestore document with all profile data
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, {
        ...profileData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Refresh user data to reflect changes
      await refreshUser();
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };



  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      isLoading: loading, 
      isAdmin, 
      isProfessional, 
      login, 
      register, 
      logout,
      refreshUser,
      updateUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

