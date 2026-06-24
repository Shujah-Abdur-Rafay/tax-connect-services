# 🚀 Deploy refund-connect.com with SSL - ACTION REQUIRED

## ⚠️ IMPORTANT: Manual Steps Required
SSL certificates **cannot be configured through code**. You must complete these steps manually.

## 🎯 Quick Start (Choose One Method)

### ✅ METHOD 1: Firebase Hosting (Recommended - Already Configured)

#### Step 1: Deploy to Firebase
```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Build your app
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

#### Step 2: Add Custom Domain in Firebase Console
1. Go to: https://console.firebase.google.com
2. Select your project
3. Click **Hosting** in left sidebar
4. Click **Add custom domain**
5. Enter: `refund-connect.com`
6. Firebase will show you DNS records to add

#### Step 3: Update DNS at Domain Registrar
Login to where you bought `refund-connect.com` (GoDaddy, Namecheap, etc.) and add:

```
Type: A
Name: @
Value: [IP provided by Firebase]

Type: TXT
Name: @
Value: [Verification code from Firebase]
```

#### Step 4: Wait for SSL
- DNS propagation: 1-4 hours
- SSL auto-provisioned by Firebase: Free & automatic
- Total time: Usually 2-6 hours

---

### ✅ METHOD 2: Netlify (Alternative - Easier UI)

#### Step 1: Build Your App
```bash
npm run build
```

#### Step 2: Deploy to Netlify
1. Go to: https://app.netlify.com
2. Drag & drop the `dist` folder
3. Or connect GitHub repo for auto-deploy

#### Step 3: Add Custom Domain
1. In Netlify dashboard → **Domain settings**
2. Click **Add custom domain**
3. Enter: `refund-connect.com`

#### Step 4: Update DNS Records
At your domain registrar, add:
```
Type: A
Name: @
Value: 75.2.60.5

Type: CNAME
Name: www
Value: [your-site].netlify.app
```

#### Step 5: Enable SSL
1. Netlify dashboard → **Domain settings**
2. Click **Verify DNS configuration**
3. Click **Provision certificate**
4. Wait 1-24 hours for SSL activation

---

## 🔍 Check Current Status

### Test DNS Configuration
```bash
nslookup refund-connect.com
```

### Test SSL After Setup
```bash
curl -I https://refund-connect.com
```

Or visit: https://www.ssllabs.com/ssltest/analyze.html?d=refund-connect.com

---

## ⏱️ Timeline
- **DNS Update**: 1-4 hours (sometimes up to 48 hours)
- **SSL Provisioning**: Automatic after DNS verified
- **Total**: Usually working within 6 hours

## 🆘 Troubleshooting
- Clear browser cache / try incognito
- Check DNS propagation: https://dnschecker.org
- Verify domain registrar DNS settings saved correctly
- Contact hosting support if issues persist after 48 hours

## ✅ You'll Know It's Working When:
- `https://refund-connect.com` loads without errors
- Browser shows padlock icon 🔒
- No ERR_SSL_PROTOCOL_ERROR
