# 🌐 Famous.ai Custom Domain Setup - refund-connect.com

## Current Issue
Your app is hosted on Famous.ai but `refund-connect.com` is not loading.

## ✅ Step-by-Step Fix

### Step 1: Add Domain in Famous.ai Dashboard
1. Go to your Famous.ai project dashboard
2. Click **Settings** or **Domains**
3. Click **Add Custom Domain**
4. Enter: `refund-connect.com`
5. Famous.ai will show you DNS records to add

### Step 2: Configure DNS at GoDaddy
1. Login to GoDaddy: https://dcc.godaddy.com
2. Go to **My Products** → **Domains**
3. Click on `refund-connect.com`
4. Click **DNS** or **Manage DNS**

### Step 3: Add DNS Records (Famous.ai will provide these)

**Option A: A Record (Most Common)**
- Type: **A**
- Name: **@**
- Value: `[IP provided by Famous.ai]`
- TTL: 600

**Option B: CNAME Record**
- Type: **CNAME**
- Name: **@** or **www**
- Value: `[subdomain provided by Famous.ai]`
- TTL: 600

### Step 4: Wait for DNS Propagation
- Takes 5 minutes to 48 hours
- Usually works within 1-2 hours

## 🔍 Troubleshooting

### Check DNS Status
```bash
nslookup refund-connect.com
```

### Check if Domain Points to Famous.ai
```bash
dig refund-connect.com
```

### Common Issues:
1. **DNS not updated** - Wait longer or clear DNS cache
2. **Wrong IP/CNAME** - Double-check Famous.ai dashboard
3. **GoDaddy proxy enabled** - Disable if present
4. **Existing A records** - Delete old records first

## 🚀 Quick Test
After setup, test:
- http://refund-connect.com
- https://refund-connect.com
- www.refund-connect.com

## 📧 Need Help?
Contact Famous.ai support with:
- Domain: refund-connect.com
- Registrar: GoDaddy
- Issue: Custom domain not connecting
