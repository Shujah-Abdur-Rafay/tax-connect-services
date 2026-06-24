# Member Access & Profile Management Guide

## Overview
All authenticated users (including Gerald Shava) have full access to the member area and can manage their professional profiles.

## Accessing Member Features

### 1. Member Portal Access
**Any logged-in user can access the Member Portal in three ways:**

- **Navigation Bar**: Click "Member Portal" in the top navigation
- **User Dropdown**: Click your avatar → "Member Portal"
- **Direct URL**: Navigate to `/member-portal`

### 2. Profile Settings Access
**Update your profile information:**

- **User Dropdown**: Click your avatar → "Profile Settings"
- **Direct URL**: Navigate to `/profile`

## Professional Profile Management

### For Gerald Shava & All Members

#### Creating a Professional Profile
1. Log in to your account
2. Click your avatar → "Profile Settings"
3. Navigate to the "Professional" tab
4. Fill in all required fields:
   - Full Name *
   - Location *
   - Bio *
   - Years of Experience *
   - Business Name (optional)
   - Phone (optional)
   - Services (comma-separated)
   - Specializations (comma-separated)
5. Click "Create Professional Profile"

#### Updating Existing Profile
1. Follow steps 1-3 above
2. Modify any fields you want to update
3. Click "Save Professional Profile"

#### Profile Visibility
- Once created/updated, your profile is automatically published (`is_published: true`)
- Your profile will appear in the "Find Professionals" directory
- Clients can search and find you by name, location, or services

## Member Portal Features

### Available Tabs (8 total):
1. **Dashboard**: Overview of your account activity
2. **Documents**: Document management and sharing
3. **Tax Docs**: Upload and manage tax documents
4. **Services**: Document processing services
5. **Messages**: Communication with clients/professionals
6. **Billing**: Subscription and billing management
7. **Payments**: Payment history and invoices
8. **Notifications**: Notification preferences
9. **Profile**: Quick access to profile settings

## Gerald Shava Specific Setup

### Current Account Status
- Email: `gerald.shava@taxexperts.com` (in Supabase)
- Firebase Auth: May use different email
- Professional profile exists in Supabase database

### If Profile Not Visible
1. Ensure you're logged in with the correct email
2. Go to Profile Settings → Professional tab
3. The form will load your existing data from Supabase
4. Make any updates and click "Save Professional Profile"
5. Profile will be immediately searchable in directory

### Troubleshooting
- **Can't see professional data**: Email mismatch between Firebase and Supabase
- **Solution**: Update profile through Professional tab - it will link accounts
- **Profile not searchable**: Ensure `is_published` is true (automatic on save)

## Technical Details

### Database Integration
- **Authentication**: Firebase Auth
- **Professional Profiles**: Supabase `professionals` table
- **Linking**: Profiles linked by email address
- **Edge Function**: `update-professional-profile` handles create/update

### Profile Fields in Supabase
- `email` (unique identifier)
- `full_name`, `business_name`
- `phone`, `location`
- `bio`, `years_experience`
- `services[]`, `specializations[]`
- `rating`, `review_count`
- `is_published` (controls visibility)

## Support
If you encounter any issues accessing or updating your profile, contact the administrator.
