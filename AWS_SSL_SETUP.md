# AWS SSL Certificate Setup for refund-connect.com

## Overview
Your domain is registered with GoDaddy but hosted on AWS. This guide covers SSL setup using AWS Certificate Manager (ACM).

## Step 1: Identify Your AWS Hosting Service

First, determine which AWS service is hosting your site:
- **CloudFront + S3**: Static website hosting
- **Elastic Beanstalk**: Full application hosting
- **EC2 + Load Balancer**: Server-based hosting
- **AWS Amplify**: Modern web app hosting

## Step 2: Request SSL Certificate in AWS Certificate Manager

### 2.1 Access AWS Certificate Manager
1. Log in to AWS Console: https://console.aws.amazon.com
2. Search for "Certificate Manager" or navigate to ACM
3. **Important**: Select **US East (N. Virginia) us-east-1** region for CloudFront
4. Click "Request a certificate"

### 2.2 Request Certificate
1. Choose "Request a public certificate"
2. Add domain names:
   - `refund-connect.com`
   - `www.refund-connect.com`
3. Select validation method: **DNS validation** (recommended)
4. Click "Request"

### 2.3 DNS Validation
1. ACM will provide CNAME records for validation
2. Copy the CNAME Name and CNAME Value
3. Go to GoDaddy DNS Management (next step)

## Step 3: Add DNS Validation Records in GoDaddy

### 3.1 Access GoDaddy DNS
1. Log in to GoDaddy: https://dcc.godaddy.com
2. Go to "My Products" → "Domains"
3. Click on `refund-connect.com`
4. Click "DNS" or "Manage DNS"

### 3.2 Add CNAME Records for Validation
1. Click "Add" or "Add Record"
2. Type: **CNAME**
3. Name: (paste the CNAME name from ACM, remove the domain part)
4. Value: (paste the CNAME value from ACM)
5. TTL: 600 seconds
6. Click "Save"
7. Repeat for www subdomain if needed

### 3.3 Wait for Validation
- Validation typically takes 5-30 minutes
- Check ACM console for "Issued" status
- Do not proceed until certificate shows "Issued"

## Step 4: Configure SSL on Your AWS Service

### Option A: CloudFront + S3 (Static Site)

1. **Go to CloudFront Console**
2. Select your distribution
3. Click "Edit"
4. Under "Custom SSL Certificate":
   - Select your ACM certificate from dropdown
   - Security Policy: TLSv1.2_2021 (recommended)
5. Under "Alternate Domain Names (CNAMEs)":
   - Add: `refund-connect.com`
   - Add: `www.refund-connect.com`
6. Click "Save Changes"
7. Wait for deployment (5-15 minutes)

### Option B: Elastic Beanstalk

1. **Go to Elastic Beanstalk Console**
2. Select your environment
3. Go to "Configuration" → "Load Balancer"
4. Add listener:
   - Port: 443
   - Protocol: HTTPS
   - SSL Certificate: Select your ACM certificate
5. Apply changes

### Option C: Application Load Balancer

1. **Go to EC2 Console** → "Load Balancers"
2. Select your load balancer
3. Go to "Listeners" tab
4. Click "Add listener":
   - Protocol: HTTPS
   - Port: 443
   - Default action: Forward to target group
   - SSL Certificate: Select your ACM certificate
5. Save

### Option D: AWS Amplify

1. **Go to Amplify Console**
2. Select your app
3. Go to "Domain management"
4. Click "Add domain"
5. Enter: `refund-connect.com`
6. Amplify will automatically:
   - Request ACM certificate
   - Configure SSL
   - Provide DNS records

## Step 5: Update DNS Records in GoDaddy

### 5.1 Get Your AWS Endpoint

**For CloudFront:**
- Copy CloudFront distribution domain (e.g., `d111111abcdef8.cloudfront.net`)

**For Load Balancer:**
- Copy DNS name (e.g., `my-lb-1234567890.us-east-1.elb.amazonaws.com`)

**For Amplify:**
- Amplify provides specific DNS records in Domain management

### 5.2 Update A Records in GoDaddy

**For CloudFront/Load Balancer:**
1. In GoDaddy DNS Management
2. Delete existing A records for `@` and `www`
3. Add new A records:
   - Type: **A** (or ALIAS if available)
   - Name: **@**
   - Value: Your CloudFront/LB domain
   - TTL: 600
4. Add www subdomain:
   - Type: **CNAME**
   - Name: **www**
   - Value: `refund-connect.com`
   - TTL: 600

**Note:** GoDaddy may not support ALIAS records. If A record doesn't accept domain names, you need to:
- Use CloudFront with a CNAME record, OR
- Get the IP addresses from your load balancer and use A records

### Alternative: Use CNAME for www only
- Point `www.refund-connect.com` (CNAME) to CloudFront/LB
- Redirect `refund-connect.com` to `www.refund-connect.com`

## Step 6: Force HTTPS Redirect

### For CloudFront:
1. Edit CloudFront distribution
2. Under "Viewer Protocol Policy": Select "Redirect HTTP to HTTPS"
3. Save changes

### For Load Balancer:
1. Add HTTP listener (port 80)
2. Configure redirect action to HTTPS (port 443)

### For Amplify:
- HTTPS redirect is automatic

## Step 7: Verify SSL Setup

### 7.1 Wait for DNS Propagation
- DNS changes take 1-48 hours
- Check propagation: https://dnschecker.org

### 7.2 Test SSL Certificate
```bash
# Test SSL certificate
curl -I https://refund-connect.com

# Check SSL details
openssl s_client -connect refund-connect.com:443 -servername refund-connect.com
```

### 7.3 Online SSL Checkers
- https://www.ssllabs.com/ssltest/
- https://www.sslshopper.com/ssl-checker.html

## Troubleshooting

### Certificate Not Showing in Dropdown
- Ensure certificate is in **us-east-1** region for CloudFront
- Wait for certificate status to be "Issued"

### DNS Validation Stuck
- Verify CNAME records in GoDaddy are correct
- Remove any trailing dots from CNAME values
- Wait 30 minutes and refresh ACM console

### Site Not Loading with HTTPS
- Check CloudFront/LB is deployed (can take 15 minutes)
- Verify alternate domain names (CNAMEs) are configured
- Check DNS records are pointing to correct endpoint

### Mixed Content Warnings
- Update all internal links to use HTTPS
- Check for hardcoded HTTP URLs in code
- Update API endpoints to HTTPS

### GoDaddy DNS Not Accepting Domain in A Record
- Use CNAME for www subdomain only
- Consider using Route 53 for DNS (supports ALIAS records)
- Or use CloudFlare as DNS proxy with SSL

## Quick Checklist

- [ ] Request ACM certificate in us-east-1
- [ ] Add DNS validation CNAME records in GoDaddy
- [ ] Wait for certificate to show "Issued"
- [ ] Configure SSL on CloudFront/Load Balancer/Amplify
- [ ] Add alternate domain names (CNAMEs)
- [ ] Update DNS A/CNAME records in GoDaddy
- [ ] Enable HTTPS redirect
- [ ] Wait for DNS propagation (24-48 hours)
- [ ] Test SSL with online tools
- [ ] Update all links to HTTPS

## Need Help?

**AWS Support:**
- AWS Support Center in console
- AWS Documentation: https://docs.aws.amazon.com/acm/

**GoDaddy Support:**
- Phone: 1-480-505-8877
- Help: https://www.godaddy.com/help

## Estimated Timeline
- Certificate request: 5 minutes
- DNS validation: 5-30 minutes
- SSL configuration: 10 minutes
- CloudFront deployment: 5-15 minutes
- DNS propagation: 1-48 hours
- **Total: 2-48 hours**
