# Firebase Storage Setup Guide

## Quick Fix for "storage/retry-limit-exceeded" Error

This error occurs when Firebase Storage is not enabled. Follow these steps:

---

## Step 1: Enable Firebase Storage (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **refund-connect-1m30**
3. Click **Storage** in the left sidebar (under "Build")
4. Click **Get Started**
5. Review the security rules dialog
6. Click **Next**
7. Select your Cloud Storage location (choose closest to your users)
8. Click **Done**

✅ Storage is now enabled!

---

## Step 2: Configure Security Rules

### Navigate to Rules
1. In Firebase Console, go to **Storage** → **Rules** tab
2. Replace the default rules with the configuration below

### Production-Ready Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile images - public read, authenticated write (own profile only)
    match /profiles/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null 
                  && request.auth.uid == userId
                  && request.resource.size < 5 * 1024 * 1024  // Max 5MB
                  && request.resource.contentType.matches('image/.*');
    }
    
    // User documents - authenticated users only (own documents)
    match /documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null 
                         && request.auth.uid == userId
                         && request.resource.size < 10 * 1024 * 1024;  // Max 10MB
    }
    
    // Tax documents bucket (if needed)
    match /tax-documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null 
                         && request.auth.uid == userId;
    }
  }
}
```

### What These Rules Do:

✅ **Profile Images** (`/profiles/{userId}/`)
- Anyone can view profile images (public read)
- Only authenticated users can upload to their own folder
- Images must be under 5MB
- Only image files allowed

✅ **User Documents** (`/documents/{userId}/`)
- Only authenticated users can access their own documents
- Max file size: 10MB
- Private (not publicly accessible)

✅ **Security Features**
- Users can only write to folders matching their user ID
- File size limits prevent abuse
- Content type validation for profile images

---

## Step 3: Verify Configuration

### Your Storage Bucket
```
refund-connect-1m30.firebasestorage.app
```

This is already configured in `src/lib/firebase.ts` - no code changes needed!

### Test the Setup
1. Log in to your app
2. Go to Member Portal → Profile
3. Upload a profile image
4. Check Firebase Console → Storage to see the uploaded file

---

## Folder Structure

Your storage will be organized as:
```
refund-connect-1m30.firebasestorage.app/
├── profiles/
│   └── {userId}/
│       └── profile.jpg
├── documents/
│   └── {userId}/
│       └── {documentName}
└── tax-documents/
    └── {userId}/
        └── {taxDocument}
```

---

## Troubleshooting

### Error: "storage/unauthorized"
- Check that security rules are published
- Verify user is authenticated
- Ensure userId in path matches authenticated user

### Error: "storage/retry-limit-exceeded"
- Storage is not enabled - complete Step 1

### Error: "storage/quota-exceeded"
- Free tier: 5GB storage, 1GB/day downloads
- Upgrade to Blaze plan for more

---

## That's it!

Once Storage is enabled and rules are configured, profile image uploads will work immediately. Users can upload avatars that persist across sessions and display throughout the app.
