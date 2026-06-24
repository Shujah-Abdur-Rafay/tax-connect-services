# Email Notification System with Gmail API

This document describes the email notification system integrated into the TaxConnect platform.

## Overview

The email notification system sends automated emails for:
- New messages
- Booking confirmations
- Profile views
- Weekly activity digests

## Architecture

### Components

1. **Email Notification Service** (`src/services/emailNotificationService.ts`)
   - Frontend service that calls the edge function
   - Provides typed functions for each notification type
   - Checks user preferences before sending

2. **Notification Preferences** (`src/components/NotificationPreferences.tsx`)
   - UI component for managing email preferences
   - Stores preferences in localStorage
   - Integrated into Member Portal

3. **Edge Function** (`send-email-notification`)
   - Server-side function using Gmail API
   - Generates HTML email templates
   - Sends emails via Gmail SMTP

## Environment Variables

Required environment variables (already configured):
- `GMAIL_USER`: Gmail account email
- `GMAIL_APP_PASSWORD`: Gmail app-specific password

## Email Templates

### 1. New Message Notification
```typescript
sendNewMessageEmail(
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  message: string,
  messageLink: string
)
```

### 2. Booking Confirmation
```typescript
sendBookingConfirmationEmail(
  clientEmail: string,
  clientName: string,
  professionalName: string,
  serviceName: string,
  date: string,
  time: string,
  amount: number,
  bookingLink: string
)
```

### 3. Profile View Notification
```typescript
sendProfileViewEmail(
  professionalEmail: string,
  professionalName: string,
  viewerName: string,
  profileLink: string
)
```

### 4. Weekly Activity Digest
```typescript
sendWeeklyDigestEmail(
  userEmail: string,
  userName: string,
  stats: {
    newMessages: number;
    profileViews: number;
    bookings: number;
    reviews: number;
  },
  dashboardLink: string
)
```

## User Preferences

Users can manage their email notification preferences in the Member Portal under the "Notifications" tab.

Available preferences:
- ✉️ New Messages
- 📅 Booking Confirmations
- 👁️ Profile Views
- 📊 Weekly Activity Digest

Preferences are stored in localStorage and checked before sending each email.

## Integration Points

### ChatWindow Component
Sends email notifications when users send messages to professionals.

### BookingPaymentForm Component
Sends confirmation emails after successful booking payments.

### Member Portal
Provides UI for managing notification preferences.

## Usage Example

```typescript
import { sendNewMessageEmail } from '@/services/emailNotificationService';

// Check user preferences
const prefs = localStorage.getItem('emailNotificationPreferences');
const emailPrefs = prefs ? JSON.parse(prefs) : { new_messages: true };

if (emailPrefs.new_messages) {
  await sendNewMessageEmail(
    'recipient@example.com',
    'John Doe',
    'Jane Smith',
    'Hello, I have a question about my taxes...',
    'https://taxconnect.com/messages/123'
  );
}
```

## Future Enhancements

1. **Database Integration**: Store preferences in Supabase instead of localStorage
2. **Email Templates**: Create more sophisticated HTML templates with branding
3. **Scheduling**: Implement cron jobs for weekly digest emails
4. **Unsubscribe Links**: Add one-click unsubscribe functionality
5. **Email Tracking**: Track open rates and click-through rates
6. **SMS Notifications**: Add SMS option for urgent notifications
7. **Push Notifications**: Implement browser push notifications
8. **Notification History**: Show history of sent notifications in UI

## Troubleshooting

### Emails Not Sending
1. Verify Gmail credentials are set in environment variables
2. Check that Gmail app password is valid
3. Ensure Gmail account has "Less secure app access" enabled or use OAuth2
4. Check edge function logs for errors

### User Not Receiving Emails
1. Check spam/junk folder
2. Verify email address is correct
3. Check user's notification preferences
4. Verify edge function is deployed and running

## Security Considerations

- Gmail credentials are stored securely as environment variables
- Never expose credentials in frontend code
- All email sending happens server-side via edge functions
- User preferences control email frequency
- Consider implementing rate limiting to prevent abuse