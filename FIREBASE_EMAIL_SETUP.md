# Firebase Email Notification Setup

## Overview
This guide explains how to deploy and configure the Gmail email notification system using Firebase Cloud Functions.

## Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created and configured
- Gmail account with App Password generated

## Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

## Step 2: Login to Firebase
```bash
firebase login
```

## Step 3: Initialize Firebase Functions (if not already done)
```bash
firebase init functions
```
- Select your Firebase project
- Choose TypeScript
- Install dependencies

## Step 4: Install Dependencies
```bash
cd functions
npm install firebase-functions firebase-admin nodemailer
npm install --save-dev @types/nodemailer
cd ..
```

## Step 5: Configure Gmail Credentials

### Option A: Using Firebase Config (Recommended for Production)
```bash
firebase functions:config:set gmail.user="your-email@gmail.com"
firebase functions:config:set gmail.password="your-app-password"
```

### Option B: Using Environment Variables (Local Development)
Create `functions/.env` file:
```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

## Step 6: Deploy the Function
```bash
firebase deploy --only functions:sendEmail
```

## Step 7: Test the Function

### Test New Message Email
```bash
firebase functions:shell
```
Then in the shell:
```javascript
sendEmail({type: 'new-message', emailData: {recipientEmail: 'test@example.com', recipientName: 'John', senderName: 'Jane', messagePreview: 'Hello!', messageUrl: 'https://example.com'}})
```

## Email Templates

### 1. New Message
- **Type**: `new-message`
- **Data**: recipientEmail, recipientName, senderName, messagePreview, messageUrl

### 2. Booking Confirmation
- **Type**: `booking-confirmation`
- **Data**: recipientEmail, clientName, professionalName, serviceName, dateTime, amount, bookingId, bookingUrl

### 3. Profile View
- **Type**: `profile-view`
- **Data**: recipientEmail, professionalName, viewerName, viewedAt, profileUrl

### 4. Weekly Digest
- **Type**: `weekly-digest`
- **Data**: recipientEmail, userName, weekRange, newMessages, profileViews, newBookings, earnings, dashboardUrl

## Troubleshooting

### Gmail Authentication Error
- Ensure 2-factor authentication is enabled on Gmail
- Generate App Password from Google Account settings
- Use App Password, not regular password

### Function Not Deploying
```bash
# Check Firebase project
firebase projects:list

# Check function logs
firebase functions:log --only sendEmail
```

### CORS Issues
The function includes CORS headers for web requests. If issues persist, check Firebase console.

## Security Notes
- Never commit Gmail credentials to version control
- Use Firebase config or environment variables
- Rotate App Passwords regularly
- Monitor function usage in Firebase Console

## Cost Considerations
- Firebase Functions free tier: 2M invocations/month
- Gmail sending limits: 500 emails/day for regular accounts
- Consider using SendGrid or similar for high volume
