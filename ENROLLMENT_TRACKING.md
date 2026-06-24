# Enrollment Tracking Setup

This guide explains how to set up enrollment tracking so you can see all membership enrollments in your admin panel.

## Step 1: Create the Database Table

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  prior_year_bank_products TEXT,
  membership_level TEXT,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_enrollments_email ON enrollments(email);
CREATE INDEX idx_enrollments_created_at ON enrollments(created_at DESC);
```

## Step 2: Update the Edge Function

Your `create-subscription` edge function needs to be updated to save enrollments to the database. 

Replace the function code with the version in `edge-functions/create-subscription-updated.ts`

## Step 3: View Enrollments

Once set up, you can view all enrollments at:
**`/admin/enrollments`**

This page shows:
- All enrollment submissions
- Contact information
- Experience level
- Membership level chosen
- Submission date/time
- Status (pending/active)

## What Gets Saved

When someone enrolls:
1. Their form data is saved to the `enrollments` table
2. They are redirected to Stripe for payment
3. The Stripe session ID is stored with their enrollment
4. You can view all enrollments in the admin panel

## Simple and Working!

No complicated email setup needed - everything is stored in your database and viewable in the admin panel.
