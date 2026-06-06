# Gerald Shava Member Portal Access - Troubleshooting Guide

## Issue
Gerald Shava (geraldgaraba@gmail.com) cannot see the Member Portal link in the top menu.

## Root Cause
The Member Portal link appears when `user` exists in the AuthContext. The AuthContext loads user data from **Firestore**, not just Firebase Auth.

## Required Setup

### Step 1: Verify Firebase Auth Account
1. Go to Firebase Console → Authentication
2. Find user: geraldgaraba@gmail.com
3. Note the **User UID** (you'll need this)

### Step 2: Create/Update Firestore User Document
1. Go to Firebase Console → Firestore Database
2. Navigate to the `users` collection
3. Look for a document with ID matching Gerald's UID

**If document exists:**
- Click on the document
- Ensure it has these fields:
  ```
  email: "geraldgaraba@gmail.com"
  name: "Gerald Shava"
  role: "professional"  ← MUST BE "professional"
  emailVerified: true
  createdAt: (timestamp)
  ```

**If document does NOT exist:**
- Click "Add document"
- Document ID: [Gerald's Firebase Auth UID]
- Add fields:
  ```
  email: "geraldgaraba@gmail.com"
  name: "Gerald Shava"
  role: "professional"
  emailVerified: true
  createdAt: [current timestamp]
  ```

### Step 3: Verify Professional Profile
1. In Firestore, check the `professionals` collection
2. Look for Gerald's professional profile
3. If missing, create document with his UID containing:
  ```
  userId: [Gerald's UID]
  name: "Gerald Shava"
  email: "geraldgaraba@gmail.com"
  specialties: ["Tax Preparation", "Financial Planning"]
  bio: "Professional tax consultant"
  verified: true
  ```

### Step 4: Test Access
1. Have Gerald log out completely
2. Clear browser cache/cookies
3. Log back in with geraldgaraba@gmail.com
4. Member Portal link should now appear in top menu

## How the System Works

```
Firebase Auth (Login) 
    ↓
AuthContext checks Firestore users/{uid}
    ↓
If role === "professional" → isProfessional = true
    ↓
Header.tsx shows Member Portal link if user exists
```

## Common Issues

**Issue: Link still not showing**
- Clear browser cache completely
- Check browser console for errors
- Verify Firestore rules allow read access

**Issue: "Permission Denied" errors**
- Check Firestore Security Rules
- Ensure authenticated users can read their own user document

**Issue: Shows as "client" instead of "professional"**
- Double-check the `role` field in Firestore is exactly "professional" (lowercase)
- Log out and log back in to refresh the auth state

## Quick Verification Script
Have Gerald open browser console and run:
```javascript
// Check current auth state
console.log('User:', auth.currentUser);
console.log('Email:', auth.currentUser?.email);
console.log('UID:', auth.currentUser?.uid);
```

Then check Firestore for a document at: `users/{UID}` with `role: "professional"`
