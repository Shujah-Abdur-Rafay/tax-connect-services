# Firebase Setup Instructions

## Quick Start Guide

### Step 1: Firebase Console Setup

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project** (or create a new one)

### Step 2: Enable Authentication

1. In Firebase Console, click **Authentication** in the left sidebar
2. Click **Get Started**
3. Go to **Sign-in method** tab
4. Enable **Email/Password** provider
5. Click **Save**

### Step 3: Enable Firestore Database

1. In Firebase Console, click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in production mode**
4. Select your preferred location
5. Click **Enable**

### Step 4: Set Firestore Security Rules

1. In Firestore Database, go to **Rules** tab
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Professionals collection - public read, authenticated write
    match /professionals/{professionalId} {
      allow read: if true;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         request.auth.uid == professionalId);
    }
  }
}
```

3. Click **Publish**

### Step 5: Add Gerald Shava's Account

#### Create Authentication User:
1. Go to **Authentication** → **Users** tab
2. Click **Add user**
3. Enter:
   - Email: `geraldgaraba@gmail.com`
   - Password: (choose a secure password)
4. Click **Add user**
5. **Copy the User UID** (you'll need this)

#### Add User Document in Firestore:
1. Go to **Firestore Database**
2. Click **Start collection**
3. Collection ID: `users`
4. Document ID: (paste the User UID from above)
5. Add fields:
   - `name` (string): `Gerald Shava`
   - `email` (string): `geraldgaraba@gmail.com`
   - `role` (string): `professional`
   - `createdAt` (string): `2025-10-21T18:00:00.000Z`
6. Click **Save**

#### Add Professional Profile:
1. In Firestore, click **Start collection** (or add to existing)
2. Collection ID: `professionals`
3. Document ID: (paste the same User UID)
4. Add fields:
   - `name` (string): `Gerald Shava`
   - `email` (string): `geraldgaraba@gmail.com`
   - `specialty` (string): `Individual and Small Business Tax Returns`
   - `location` (string): `23814 Michigan Ave, Dearborn, MI 48124`
   - `phone` (string): `(800) 408-1040`
   - `rating` (number): `4.9`
   - `reviewCount` (number): `287`
   - `yearsExperience` (number): `21`
   - `hourlyRate` (number): `150`
   - `bio` (string): `Specialized in Individual and Small Business Tax Returns with over 21 years of experience helping clients maximize their refunds and minimize tax liabilities.`
   - `profileImage` (string): `https://cdn.jsdelivr.net/gh/famous-ai/cdn@main/professional-male-african-american.jpg`
   - `certifications` (array): `["CPA", "Enrolled Agent"]`
   - `languages` (array): `["English"]`
   - `availability` (string): `Monday-Friday 9AM-6PM`
   - `specializations` (array): `["Individual Tax Returns", "Small Business Tax", "Tax Planning"]`
   - `services` (array): `["Tax Preparation", "Tax Planning", "IRS Representation"]`
5. Click **Save**

### Step 6: Test Login

1. Go to your application
2. Click **Login**
3. Enter:
   - Email: `geraldgaraba@gmail.com`
   - Password: (the password you set)
4. Click **Login**

You should now be logged in as Gerald Shava!

## Troubleshooting

**Login not working?**
- Check that Email/Password is enabled in Authentication
- Verify the email and password are correct
- Check browser console for errors

**Professional not showing?**
- Verify the professional document exists in Firestore
- Check that the document ID matches the user UID
- Ensure Firestore rules are published

**Need help?**
- Check Firebase Console logs
- Review browser console for errors
- Verify all environment variables are set correctly
