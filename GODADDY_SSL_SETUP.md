# GoDaddy SSL Setup for refund-connect.com

## Step 1: Enable SSL Certificate in GoDaddy

### Option A: Free SSL Certificate (Recommended)
1. Log in to your GoDaddy account
2. Go to **My Products** → **Web Hosting**
3. Click **Manage** next to your hosting plan
4. In cPanel, find **Security** section
5. Click **SSL/TLS Status**
6. Check the box next to `refund-connect.com` and `www.refund-connect.com`
7. Click **Run AutoSSL** - this installs a free Let's Encrypt certificate

### Option B: Purchased SSL Certificate
1. Go to **My Products** → **SSL Certificates**
2. Click **Set Up** next to your certificate
3. Select `refund-connect.com` as the domain
4. Follow the verification steps
5. Wait 5-10 minutes for activation

## Step 2: Force HTTPS Redirect

### Using .htaccess (Already Configured)
Your project already has `.htaccess` in the `public` folder with HTTPS redirect rules.

Verify the file contains:
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

## Step 3: Deploy Your Application

### Upload via FTP/File Manager
1. In GoDaddy cPanel, go to **Files** → **File Manager**
2. Navigate to `public_html` folder
3. Delete default files (index.html, etc.)
4. Build your project locally: `npm run build`
5. Upload all files from `dist` folder to `public_html`
6. Ensure `.htaccess` is uploaded

### Or use FTP Client
- **Host**: Your domain or IP from GoDaddy
- **Username**: FTP username from GoDaddy
- **Password**: FTP password from GoDaddy
- **Port**: 21
- Upload `dist` folder contents to `public_html`

## Step 4: Verify SSL Installation

1. Visit `https://refund-connect.com` (should load with padlock)
2. Visit `http://refund-connect.com` (should redirect to HTTPS)
3. Check certificate: Click padlock → Certificate → Should show valid SSL

### SSL Checker Tool
Visit: https://www.sslshopper.com/ssl-checker.html
Enter: `refund-connect.com`

## Step 5: Update Environment Variables

If using Firebase/Supabase, update allowed domains:
- Firebase Console → Authentication → Settings → Authorized domains
- Add: `refund-connect.com` and `www.refund-connect.com`

## Troubleshooting

### SSL Not Working After 24 Hours
1. Clear browser cache
2. Check DNS propagation: https://dnschecker.org
3. Verify SSL in GoDaddy: cPanel → SSL/TLS Status
4. Re-run AutoSSL if needed

### Mixed Content Errors
- Update all `http://` URLs to `https://` in your code
- Check browser console for blocked resources

### 404 Errors on Refresh
- Verify `.htaccess` is in `public_html`
- Check RewriteBase is set correctly

## Quick Checklist
- [ ] SSL certificate activated in GoDaddy
- [ ] Application built: `npm run build`
- [ ] Files uploaded to `public_html`
- [ ] `.htaccess` file present
- [ ] HTTPS redirect working
- [ ] Certificate valid (green padlock)
- [ ] All pages load correctly
- [ ] Firebase/Supabase domains updated

## Support
- GoDaddy SSL Support: 1-480-505-8877
- SSL Documentation: https://www.godaddy.com/help/install-ssl-certificate
