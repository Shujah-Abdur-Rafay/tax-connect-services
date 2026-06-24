# Firebase Troubleshooting Guide

## "Client is Offline" Error

If you see a spinning login with "client is offline" error, follow these steps:

### 1. Check Firebase Console Setup

#### Create Firestore Database
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `refund-connect-1m30`
3. Click **Firestore Database** in the left sidebar
4. Click **Create database**
5. Choose **Production mode** or **Test mode**
   - **Test mode**: Easier for development (expires in 30 days)
   - **Production mode**: Requires security rules setup
6. Select a location (choose closest to your users)
7. Click **Enable**

#### Enable Authentication
1. In Firebase Console, click **Authentication**
2. Click **Get started** if not already enabled
3. Go to **Sign-in method** tab
4. Click **Email/Password**
5. Toggle **Enable** switch
6. Click **Save**

### 2. Configure Firestore Security Rules

#### For Test Mode (Development)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

#### For Production Mode
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    match /professionals/{professionalId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /documents/{documentId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### 3. Verify Firebase Configuration

Check your `.env` file or `src/lib/firebase.ts`:

```env
VITE_FIREBASE_API_KEY=AIzaSyBjwKpTXm8bBr8oTEQkpaDBCPfm5ZVkl5k
VITE_FIREBASE_AUTH_DOMAIN=refund-connect-1m30.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=refund-connect-1m30
VITE_FIREBASE_STORAGE_BUCKET=refund-connect-1m30.firebasestorage.app
```

### 4. Check Browser Console

Open Developer Tools (F12) and look for:
- ✅ "Firebase app initialized"
- ✅ "Firebase Auth initialized"
- ✅ "Firestore initialized"
- ❌ Any red error messages

### 5. Common Issues

#### Issue: "Missing or insufficient permissions"
**Solution**: Update Firestore security rules (see step 2)

#### Issue: "Firebase: Error (auth/configuration-not-found)"
**Solution**: Enable Email/Password authentication (see step 1)

#### Issue: Network errors
**Solution**: 
- Check internet connection
- Disable VPN/firewall temporarily
- Check if Firebase services are down: https://status.firebase.google.com/

#### Issue: "Multiple tabs open" warning
**Solution**: Close other tabs with the app open, or ignore (it's just a warning)

### 6. Test Login

After setup, test with these steps:
1. Click **Sign Up** to create a test account
2. Use a real email address
3. Check browser console for success messages
4. Try logging in with the new account

### 7. Create Test User Manually

If signup isn't working, create a user in Firebase Console:
1. Go to **Authentication** > **Users**
2. Click **Add user**
3. Enter email and password
4. Click **Add user**
5. Go to **Firestore Database**
6. Create a document in `users` collection:
   - Document ID: (copy the UID from Authentication)
   - Fields:
     - `name`: "Test User"
     - `email`: "test@example.com"
     - `role`: "client"
     - `emailVerified`: false

### 8. Still Not Working?

Check the detailed setup guides:
- `FIREBASE_SETUP.md` - Complete Firebase setup
- `FIREBASE_AUTH_SETUP_REQUIRED.md` - Authentication setup
- `FIREBASE_STORAGE.md` - Storage configuration

### Support

If issues persist:
1. Check browser console for specific error codes
2. Verify all Firebase services are enabled
3. Try in incognito mode to rule out browser extensions
4. Clear browser cache and reload
