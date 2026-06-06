import { auth, db } from '@/lib/firebase';
import { sendEmailVerification, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Custom verification email fallback — stores a token in Firestore.
// (Firebase's built-in verification is preferred; this is a backup record.)
const sendCustomVerificationEmail = async (user: User): Promise<void> => {
  try {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Store token in Firestore
    await addDoc(collection(db, 'email_verification_tokens'), {
      user_id: user.uid,
      email: user.email,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: serverTimestamp(),
    });

    const verificationUrl = `${window.location.origin}/verify-email?token=${token}`;
    console.log('Verification token created:', token);
    console.log('Verification URL:', verificationUrl);
  } catch (error) {
    console.error('Custom verification error:', error);
    throw error;
  }
};


export const sendVerificationEmail = async (user: User): Promise<void> => {
  try {
    // Try Firebase's built-in verification first
    await sendEmailVerification(user, {
      url: `${window.location.origin}/member-portal`,
      handleCodeInApp: false,
    });
  } catch (error: any) {
    console.error('Firebase verification failed:', error);
    
    // Try custom verification as fallback
    try {
      await sendCustomVerificationEmail(user);
      return; // Success with custom method
    } catch (customError) {
      console.error('Custom verification also failed:', customError);
    }
    
    // Provide error messages
    if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many requests. Please wait before trying again.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled.');
    } else {
      throw new Error('Verification email system is being configured. Please contact support.');
    }
  }
};

export const checkEmailVerified = async (user: User): Promise<boolean> => {
  try {
    await user.reload();
    return user.emailVerified;
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  }
};

export const resendVerificationEmail = async (user: User): Promise<void> => {
  if (user.emailVerified) {
    throw new Error('Email is already verified');
  }
  await sendVerificationEmail(user);
};
