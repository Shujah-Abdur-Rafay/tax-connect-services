import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBjwKpTXm8bBr8oTEQkpaDBCPfm5ZVkl5k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "refund-connect-1m30.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "refund-connect-1m30",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "refund-connect-1m30.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "540713290869",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:540713290869:web:9b2358f3ab18da4072fc3c",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-B4TRYC5CQZ"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Initialize Firebase
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized');
  } else {
    app = getApps()[0];
    console.log('✅ Using existing Firebase app');
  }

  // Initialize Auth
  auth = getAuth(app);
  console.log('✅ Firebase Auth initialized');

  // Initialize Firestore
  db = getFirestore(app);
  console.log('✅ Firestore initialized');

  // Enable offline persistence
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Persistence not available in this browser');
    }
  });

  // Initialize Storage
  try {
    storage = getStorage(app);
    console.log('✅ Firebase Storage initialized');
  } catch (storageError) {
    console.warn('⚠️ Storage not configured:', storageError);
    storage = {} as FirebaseStorage;
  }

} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw new Error('Firebase failed to initialize. Check console for details.');
}

export { auth, db, storage };
