# Email Verification in Onboarding

## Overview
The onboarding process now requires email verification after account creation. Users must verify their email address before they can proceed to profile setup.

## Flow

### Step 1: Account Creation
1. User fills out account creation form (name, email, password)
2. System creates Firebase account
3. System automatically sends verification email
4. User sees "Account created successfully! Please verify your email to continue" message

### Step 1.5: Email Verification Pending
1. User is shown the EmailVerificationPending screen
2. Screen displays:
   - Email icon and verification message
   - Email address where verification was sent
   - "I've Verified My Email" button to check status
   - "Resend Verification Email" button (with 60-second cooldown)
3. User checks their email and clicks verification link
4. User returns to the site and clicks "I've Verified My Email"
5. System checks Firebase auth status
6. If verified, user proceeds to Step 2 (Profile Setup)
7. If not verified, user sees error message

### Step 2: Profile Setup
- Only accessible after email verification
- User completes profile information
- System saves to Supabase professionals table

### Step 3: Application Form
- User completes JotForm application
- Completes onboarding process

## Components

### EmailVerificationPending.tsx
- Shows verification pending UI
- Checks verification status via Firebase
- Resends verification email with cooldown
- Calls onVerified callback when verified

### TaxProfessionalOnboarding.tsx
- Manages overall onboarding flow
- Sends verification email after account creation
- Shows EmailVerificationPending when needed
- Only allows step 2 after email is verified

## Firebase Integration

### Email Verification
```typescript
import { sendEmailVerification, reload } from 'firebase/auth';

// Send verification email
await sendEmailVerification(user);

// Check verification status
await reload(user);
if (user.emailVerified) {
  // Proceed to next step
}
```

## Features

### Automatic Email Sending
- Verification email sent immediately after account creation
- Uses Firebase's built-in email verification system

### Resend Functionality
- Users can resend verification email
- 60-second cooldown prevents spam
- Visual countdown timer

### Status Checking
- Manual check via "I've Verified My Email" button
- Reloads user data from Firebase
- Provides feedback on verification status

### Error Handling
- Clear error messages for failed verification
- Handles network errors gracefully
- Provides guidance for users

## User Experience

### Email Template
Firebase sends a professional verification email with:
- Verification link
- Clear instructions
- Sender: noreply@refund-connect.firebaseapp.com

### Spam Folder Notice
The verification screen reminds users to:
- Check spam/junk folders
- Wait a few minutes for email delivery
- Use resend button if needed

## Security

### Email Verification Required
- Users cannot proceed without verification
- Prevents fake/invalid email addresses
- Ensures communication channel is valid

### Rate Limiting
- 60-second cooldown on resend
- Prevents email spam
- Protects system resources

## Testing

### Test Flow
1. Go to /onboarding
2. Create account with valid email
3. Check email for verification link
4. Click verification link
5. Return to site and click "I've Verified My Email"
6. Should proceed to profile setup

### Common Issues
- **Email not received**: Check spam folder, wait 5 minutes, use resend
- **Verification not detected**: Ensure you clicked link in email, try refreshing page
- **Resend disabled**: Wait for countdown to complete

## Future Enhancements
- Auto-check verification status every 30 seconds
- Email verification reminder notifications
- Custom email templates with branding
- SMS verification as alternative
