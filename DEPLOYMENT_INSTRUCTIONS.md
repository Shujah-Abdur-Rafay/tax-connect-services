# 🚀 Email Function Deployment Instructions

## ⚠️ Important Note
I'm an AI assistant that can prepare code files but **cannot execute CLI commands** or interact with external services. You'll need to manually run these commands in your terminal.

## ✅ Pre-Deployment Checklist
All code files are ready:
- ✅ `functions/src/index.ts` - Email function with 4 templates
- ✅ `functions/package.json` - Dependencies configured
- ✅ `functions/tsconfig.json` - TypeScript config
- ✅ `firebase.json` - Firebase configuration
- ✅ `.firebaserc` - Project reference file
- ✅ Frontend integration complete

## 📋 Step-by-Step Deployment

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```
This will open a browser for authentication.

### Step 3: Update Project ID
Edit `.firebaserc` and replace with your actual Firebase project ID:
```json
{
  "projects": {
    "default": "your-actual-firebase-project-id"
  }
}
```

### Step 4: Install Dependencies
```bash
cd functions
npm install
cd ..
```

### Step 5: Configure Gmail
```bash
firebase functions:config:set gmail.user="your-email@gmail.com"
firebase functions:config:set gmail.password="your-16-char-app-password"
```

**Get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Go to "App passwords"
4. Generate password for "Mail"
5. Copy the 16-character password

### Step 6: Deploy Function
```bash
firebase deploy --only functions:sendEmail
```

### Step 7: Test Deployment
After deployment, you'll see a URL like:
`https://us-central1-YOUR-PROJECT.cloudfunctions.net/sendEmail`

## 🧪 Testing Commands

Run these curl commands to test each email type:

### Test 1: New Message Email
```bash
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/sendEmail \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "new-message",
      "emailData": {
        "recipientEmail": "your-test-email@gmail.com",
        "recipientName": "Test User",
        "senderName": "John Doe",
        "messagePreview": "Hello! This is a test message.",
        "messageUrl": "https://taxproconnect.com/messages"
      }
    }
  }'
```

### Test 2: Booking Confirmation
```bash
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/sendEmail \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "booking-confirmation",
      "emailData": {
        "recipientEmail": "your-test-email@gmail.com",
        "clientName": "John Doe",
        "professionalName": "Jane Smith CPA",
        "serviceName": "Tax Consultation",
        "dateTime": "March 20, 2025 at 2:00 PM",
        "amount": "150.00",
        "bookingId": "BK123456",
        "bookingUrl": "https://taxproconnect.com/bookings/123"
      }
    }
  }'
```

### Test 3: Profile View Notification
```bash
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/sendEmail \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "profile-view",
      "emailData": {
        "recipientEmail": "your-test-email@gmail.com",
        "professionalName": "Jane Smith",
        "viewerName": "John Doe",
        "viewedAt": "March 15, 2025 at 3:30 PM",
        "profileUrl": "https://taxproconnect.com/profile"
      }
    }
  }'
```

### Test 4: Weekly Digest
```bash
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/sendEmail \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "weekly-digest",
      "emailData": {
        "recipientEmail": "your-test-email@gmail.com",
        "userName": "Jane Smith",
        "weekRange": "March 10-16, 2025",
        "newMessages": 5,
        "profileViews": 12,
        "newBookings": 3,
        "earnings": "450.00",
        "dashboardUrl": "https://taxproconnect.com/dashboard"
      }
    }
  }'
```

## 📊 Monitoring

### View Logs
```bash
firebase functions:log --only sendEmail
```

### Check Status
```bash
firebase functions:list
```

### View in Console
Go to: https://console.firebase.google.com/project/YOUR-PROJECT/functions

## 🐛 Common Issues

**"Gmail credentials not configured"**
- Run: `firebase functions:config:get`
- Verify gmail settings exist
- Redeploy after setting config

**"Invalid login credentials"**
- Use App Password, not regular password
- Ensure 2FA is enabled
- Generate new App Password

**CORS errors**
- Function includes CORS headers
- Check browser console
- Verify function URL

## 📝 What Happens Next

Once deployed, emails will automatically send when:
1. **New Message** - User sends message in ChatWindow
2. **Booking Confirmation** - Payment completed in BookingPaymentForm
3. **Profile View** - Professional profile viewed (if implemented)
4. **Weekly Digest** - Scheduled job runs (needs setup)

## 🎯 Success Indicators

✅ Function deploys without errors
✅ Test emails received in inbox
✅ Logs show successful sends
✅ No errors in Firebase Console

## 📚 Additional Resources

- Firebase Functions: https://firebase.google.com/docs/functions
- Nodemailer: https://nodemailer.com/
- Gmail App Passwords: https://support.google.com/accounts/answer/185833
