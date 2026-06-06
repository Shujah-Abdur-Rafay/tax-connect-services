# 🚀 Quick Start: Deploy Email Function in 5 Minutes

## What You Need
- Firebase project (create at https://console.firebase.google.com)
- Gmail account with 2FA enabled
- Terminal/Command Prompt

## 5-Step Deployment

### 1️⃣ Install & Login (2 minutes)
```bash
npm install -g firebase-tools
firebase login
```

### 2️⃣ Configure Project (1 minute)
Edit `.firebaserc` - replace `your-project-id` with your Firebase project ID:
```json
{
  "projects": {
    "default": "my-actual-project-id"
  }
}
```

### 3️⃣ Install Dependencies (1 minute)
```bash
cd functions
npm install
cd ..
```

### 4️⃣ Set Gmail Credentials (1 minute)
Get App Password: https://myaccount.google.com/apppasswords

```bash
firebase functions:config:set gmail.user="youremail@gmail.com"
firebase functions:config:set gmail.password="your-16-char-app-password"
```

### 5️⃣ Deploy! (30 seconds)
```bash
firebase deploy --only functions:sendEmail
```

## ✅ Test It Works

After deployment, run the test script:

```bash
# Edit test-emails.sh first:
# - Replace PROJECT_ID with your Firebase project ID
# - Replace TEST_EMAIL with your email

chmod +x test-emails.sh
./test-emails.sh
```

Or test manually with curl:
```bash
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/sendEmail \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "new-message",
      "emailData": {
        "recipientEmail": "test@example.com",
        "recipientName": "Test User",
        "senderName": "John Doe",
        "messagePreview": "Test message",
        "messageUrl": "https://taxproconnect.com/messages"
      }
    }
  }'
```

## 🎉 Done!

Your email function is now live and will automatically send:
- ✉️ New message notifications
- 📅 Booking confirmations
- 👁️ Profile view alerts
- 📊 Weekly digests

## 🐛 Troubleshooting

**Deployment fails?**
- Check `.firebaserc` has correct project ID
- Run `firebase projects:list` to see your projects

**Emails not sending?**
- Verify config: `firebase functions:config:get`
- Check logs: `firebase functions:log --only sendEmail`
- Ensure App Password is correct (not regular password)

**Need help?**
See full guide: `DEPLOYMENT_INSTRUCTIONS.md`
