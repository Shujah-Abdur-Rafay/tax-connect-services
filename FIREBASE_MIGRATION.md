# Firebase Migration Guide

## Overview
The application has been migrated from Supabase to Firebase for authentication and database operations.

## What Changed

### Authentication
- **Before**: Supabase Auth
- **After**: Firebase Authentication
- All login, signup, and logout functionality now uses Firebase Auth
- User roles (admin, professional, client) are stored in Firestore

### Database
- **Before**: Supabase PostgreSQL
- **After**: Firebase Firestore
- Professionals data is now stored in Firestore collection: `professionals`
- User data is stored in Firestore collection: `users`

## Setup Instructions

### 1. Firebase Console Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Enable **Authentication** → Email/Password sign-in method
4. Enable **Firestore Database** → Start in production mode
5. Set up Firestore security rules (see below)

### 2. Environment Variables
The following environment variables are already configured:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`

### 3. Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    match /professionals/{professionalId} {
      allow read: if true;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         request.auth.uid == professionalId);
    }
  }
}
```

### 4. Migrate Gerald Shava's Account
To create Gerald Shava's login:

1. **Create Auth User** (Firebase Console → Authentication):
   - Email: geraldgaraba@gmail.com
   - Password: (set a secure password)
   - Display Name: Gerald Shava

2. **Add to Firestore** (Firestore Console → users collection):
```json
{
  "name": "Gerald Shava",
  "email": "geraldgaraba@gmail.com",
  "role": "professional",
  "createdAt": "2025-10-21T18:00:00.000Z"
}
```
Use the UID from Authentication as the document ID.

3. **Add Professional Profile** (Firestore Console → professionals collection):
Use the same UID as document ID:
```json
{
  "name": "Gerald Shava",
  "email": "geraldgaraba@gmail.com",
  "specialty": "Individual and Small Business Tax Returns",
  "location": "23814 Michigan Ave, Dearborn, MI 48124",
  "phone": "(800) 408-1040",
  "rating": 4.9,
  "reviewCount": 287,
  "yearsExperience": 21,
  "hourlyRate": 150,
  "bio": "Specialized in Individual and Small Business Tax Returns with over 21 years of experience...",
  "profileImage": "https://cdn.jsdelivr.net/gh/famous-ai/cdn@main/professional-male-african-american.jpg",
  "certifications": ["CPA", "Enrolled Agent"],
  "languages": ["English"],
  "availability": "Monday-Friday 9AM-6PM",
  "specializations": ["Individual Tax Returns", "Small Business Tax", "Tax Planning"],
  "services": ["Tax Preparation", "Tax Planning", "IRS Representation"]
}
```

## Benefits of Firebase
✅ Simpler authentication setup
✅ No complex RLS policies
✅ Better documentation
✅ Integrated with Google ecosystem
✅ Real-time capabilities
✅ Easier to manage and scale
