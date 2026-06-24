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
import { checkAndApplyAdminElevation } from '@/services/adminManagementService';
import { MembershipLevel } from '@/constants/membershipLevels';
import {
  resolveAdminPermissions,
  canAccessAdminArea,
  type AdminPermission,
} from '@/constants/adminPermissions';

export type UserRole = 'client' | 'professional' | 'admin' | 'help_desk';

interface User {
  /** Firebase Auth UID. Available as both `id` and `uid` for compatibility. */
  id: string;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  photoURL?: string;
  membershipLevel?: MembershipLevel | string;
  /** Granted admin permissions when role === 'help_desk'. */
  helpDeskPermissions?: string[];
}





interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isProfessional: boolean;
  /** True for help-desk staff (admin-area access with granular permissions). */
  isHelpDesk: boolean;
  /** True for anyone who can reach the admin area (full admin OR help desk). */
  canAccessAdmin: boolean;
  /** Effective admin permissions (full admins have all). */
  adminPermissions: Set<AdminPermission>;
  /** Permission check — full admins always pass. */
  hasAdminPermission: (perm: AdminPermission) => boolean;
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
  const [isHelpDesk, setIsHelpDesk] = useState(false);

  useEffect(() => {
    if (!auth) {
      console.error('Firebase Auth is not initialized');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser && db) {
        // Role the Firestore doc currently records — used below to decide whether
        // an allowlisted email needs promoting to admin.
        let loadedRole = 'client';
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

          let loadedPermissions: string[] = [];
          if (userDoc.exists()) {
            const userData = userDoc.data();
            loadedRole = userData.role || 'client';
            loadedPermissions = Array.isArray(userData.helpDeskPermissions)
              ? userData.helpDeskPermissions
              : [];
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData.name || firebaseUser.displayName || 'User',
              role: userData.role || 'client',
              emailVerified: firebaseUser.emailVerified,
              photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
              membershipLevel: userData.membershipLevel || MembershipLevel.DIRECTORY_LISTING,
              helpDeskPermissions: loadedPermissions,

            });
            setIsAdmin(userData.role === 'admin');
            setIsProfessional(userData.role === 'professional');
            setIsHelpDesk(userData.role === 'help_desk');

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
            setIsHelpDesk(false);
          }

          // Admin-by-email: if this account's email is allowlisted (or a
          // bootstrap owner), promote/sync their admin access now — full admin
          // or help desk with granular permissions. Covers existing users on
          // their next login and brand-new signups. Best-effort + non-fatal.
          const elevation = await checkAndApplyAdminElevation({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            currentRole: loadedRole,
            currentPermissions: loadedPermissions,
          });
          if (elevation.role) {
            const role = elevation.role;
            const perms = elevation.permissions || loadedPermissions;
            setIsAdmin(role === 'admin');
            setIsProfessional(false);
            setIsHelpDesk(role === 'help_desk');
            setUser((prev) =>
              prev ? { ...prev, role, helpDeskPermissions: perms } : prev,
            );
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
          setIsHelpDesk(false);
        }


      } else {
        setUser(null);
        setIsAdmin(false);
        setIsProfessional(false);
        setIsHelpDesk(false);
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
          membershipLevel: userData.membershipLevel || MembershipLevel.DIRECTORY_LISTING,
          helpDeskPermissions: Array.isArray(userData.helpDeskPermissions)
            ? userData.helpDeskPermissions
            : [],
        });

        setIsAdmin(userData.role === 'admin');
        setIsProfessional(userData.role === 'professional');
        setIsHelpDesk(userData.role === 'help_desk');
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



  const adminPermissions = resolveAdminPermissions(
    user?.role,
    user?.helpDeskPermissions,
  );
  const hasAdminPermission = (perm: AdminPermission) => adminPermissions.has(perm);
  const canAccessAdmin = canAccessAdminArea(user?.role);

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      isLoading: loading,
      isAdmin,
      isProfessional,
      isHelpDesk,
      canAccessAdmin,
      adminPermissions,
      hasAdminPermission,
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

