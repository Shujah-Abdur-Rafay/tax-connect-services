# Firebase Email Verification Setup Guide

## Quick Fix (5 minutes)

The "Failed to send verification email" error occurs because Firebase Email Verification needs to be configured in your Firebase Console.

### Step 1: Enable Email Verification Templates

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Templates** tab
4. Find **Email address verification** template
5. Click **Edit** (pencil icon)
6. Customize the template (optional):
   - **Sender name**: Your App Name
   - **Subject**: Verify your email for [Your App]
   - **Body**: Customize the verification message
7. Click **Save**

### Step 2: Configure Action URL (Important!)

1. In the same Templates section
2. Scroll to **Action URL** settings
3. Set the action URL to: `https://your-domain.com/__/auth/action`
4. Or for local testing: `http://localhost:5173/__/auth/action`
5. Click **Save**

### Step 3: Verify Email/Password is Enabled

1. Go to **Authentication** → **Sign-in method** tab
2. Ensure **Email/Password** is **Enabled**
3. If not, click on it and enable it

### Step 4: Test Email Verification

1. Sign up with a new account
2. Click "Resend Verification Email"
3. Check your email inbox (and spam folder)
4. Click the verification link

## Common Issues

### "Too many requests" Error
- Firebase limits verification emails to prevent abuse
- Wait 5-10 minutes before trying again
- Consider implementing a cooldown timer in your UI

### Emails Not Arriving
- Check spam/junk folder
- Verify sender email in Firebase Console
- Check Firebase Console → Authentication → Templates for any errors
- Ensure your domain is authorized in Firebase settings

### "Configuration not found" Error
- Email verification template not set up
- Follow Step 1 above to configure templates

## Advanced Configuration

### Custom Email Templates

You can customize the verification email in Firebase Console:
- Add your logo
- Change colors and styling
- Modify the message text
- Add custom links

### Email Verification Link Behavior

The verification link will:
1. Verify the user's email
2. Redirect to the URL specified in `actionCodeSettings.url`
3. Currently set to redirect to `/member-portal`

### Rate Limiting

Firebase automatically rate limits verification emails:
- Maximum 1 email per minute per user
- Maximum 10 emails per hour per user
- Implement UI feedback to prevent spam

## Testing Locally

For local development:
1. Use a real email address (not test@example.com)
2. Ensure Firebase project is properly initialized
3. Check browser console for detailed error messages
4. Use Firebase Emulator Suite for offline testing (optional)

## Production Checklist

- [ ] Email verification template configured
- [ ] Action URL set to production domain
- [ ] Sender name and email customized
- [ ] Test with multiple email providers (Gmail, Outlook, etc.)
- [ ] Verify emails arrive within 1-2 minutes
- [ ] Check spam folder behavior
- [ ] Implement rate limiting UI feedback
- [ ] Add "Email verified" success message
