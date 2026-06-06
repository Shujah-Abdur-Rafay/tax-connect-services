# Firebase Email Function Deployment Guide

## Quick Start

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Link Your Project
Update `.firebaserc` with your Firebase project ID:
```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

### 4. Install Function Dependencies
```bash
cd functions
npm install
cd ..
```

### 5. Configure Gmail Credentials
```bash
firebase functions:config:set gmail.user="your-email@gmail.com"
firebase functions:config:set gmail.password="your-gmail-app-password"
```

**How to get Gmail App Password:**
1. Go to Google Account settings
2. Enable 2-factor authentication
3. Go to Security → App Passwords
4. Generate new app password for "Mail"
5. Copy the 16-character password

### 6. Deploy the Function
```bash
firebase deploy --only functions:sendEmail
```

### 7. Test the Function

**From Frontend (automatic):**
The function is already integrated into:
- ChatWindow.tsx (sends email when messages are sent)
- BookingPaymentForm.tsx (sends confirmation after payment)

**Manual Test via Firebase Console:**
1. Go to Firebase Console → Functions
2. Find `sendEmail` function
3. Click "Test function"
4. Use this payload:
```json
{
  "type": "new-message",
  "emailData": {
    "recipientEmail": "test@example.com",
    "recipientName": "Test User",
    "senderName": "John Doe",
    "messagePreview": "Hello, this is a test message!",
    "messageUrl": "https://your-app.com/messages"
  }
}
```

## Email Types and Data Structures

### New Message
```javascript
{
  type: 'new-message',
  emailData: {
    recipientEmail: 'user@example.com',
    recipientName: 'John Doe',
    senderName: 'Jane Smith',
    messagePreview: 'Message text...',
    messageUrl: 'https://app.com/messages'
  }
}
```

### Booking Confirmation
```javascript
{
  type: 'booking-confirmation',
  emailData: {
    recipientEmail: 'client@example.com',
    clientName: 'John Doe',
    professionalName: 'Jane Smith',
    serviceName: 'Tax Consultation',
    dateTime: 'March 15, 2025 at 2:00 PM',
    amount: '150.00',
    bookingId: 'BK123456',
    bookingUrl: 'https://app.com/bookings/123'
  }
}
```

### Profile View
```javascript
{
  type: 'profile-view',
  emailData: {
    recipientEmail: 'pro@example.com',
    professionalName: 'Jane Smith',
    viewerName: 'John Doe',
    viewedAt: 'March 15, 2025 at 3:30 PM',
    profileUrl: 'https://app.com/profile'
  }
}
```

### Weekly Digest
```javascript
{
  type: 'weekly-digest',
  emailData: {
    recipientEmail: 'user@example.com',
    userName: 'John Doe',
    weekRange: 'March 10-16, 2025',
    newMessages: 5,
    profileViews: 12,
    newBookings: 3,
    earnings: '450.00',
    dashboardUrl: 'https://app.com/dashboard'
  }
}
```

## Monitoring

### View Function Logs
```bash
firebase functions:log --only sendEmail
```

### Check Function Status
```bash
firebase functions:list
```

## Troubleshooting

### Error: "Gmail credentials not configured"
- Run: `firebase functions:config:get`
- Verify gmail.user and gmail.password are set
- Redeploy: `firebase deploy --only functions:sendEmail`

### Error: "Invalid login credentials"
- Ensure you're using App Password, not regular password
- Check 2FA is enabled on Gmail account
- Generate new App Password if needed

### Function not found
- Check deployment: `firebase functions:list`
- Verify .firebaserc has correct project ID
- Redeploy: `firebase deploy --only functions`

### CORS errors
- Function includes CORS headers
- Check browser console for specific error
- Verify function URL is correct

## Local Testing

### Start Emulator
```bash
firebase emulators:start --only functions
```

### Test Locally
The function will be available at:
`http://localhost:5001/YOUR-PROJECT-ID/us-central1/sendEmail`

## Production Checklist
- ✅ Gmail App Password configured
- ✅ Function deployed successfully
- ✅ Test email sent and received
- ✅ Frontend integration working
- ✅ Error logging enabled
- ✅ Usage monitoring set up

## Support
For issues, check:
1. Firebase Console → Functions → Logs
2. Browser console for frontend errors
3. Firebase documentation: https://firebase.google.com/docs/functions
