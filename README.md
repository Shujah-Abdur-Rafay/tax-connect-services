# Refund Connect — Tax Professional Platform

A modern platform connecting clients with certified tax professionals, powered by **Firebase** and **Stripe**.

---

## Backend Stack

This project runs entirely on Firebase. **Supabase has been fully removed.** If you see any lingering reference to Supabase anywhere in the codebase, treat it as a bug and migrate the call to the Firebase equivalent.

- **Authentication:** Firebase Auth (Email/Password)
- **Database:** Cloud Firestore
- **File Storage:** Firebase Storage
- **Server-side logic:** Firebase Cloud Functions (`functions/`)
- **Transactional Email:** Firebase Trigger Email extension (writes to the `mail` Firestore collection)
- **Payments:** Stripe (server-side keys live in `firebase functions:config`)

### Key Features
- Firebase Authentication (Email/Password)
- Firestore collections for users, professionals, conversations, orders, payments, etc.
- Real-time data synchronization through Firestore listeners
- Stripe checkout for memberships, bookings, and gig orders
- Stripe Connect Express for tax-pro payouts
- Branded email notifications via the Firebase Trigger Email extension

---

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase
Follow the detailed instructions in **FIREBASE_SETUP.md**.

Key steps:
1. Enable Authentication (Email/Password)
2. Enable Firestore Database
3. Apply the security rules in `FIRESTORE_SECURITY_RULES.md`
4. Install the **Trigger Email** Firebase Extension (collection: `mail`)
5. Set Stripe secrets via `firebase functions:config:set`

### 3. Environment Variables
Configured in `.env`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_STRIPE_PUBLISHABLE_KEY`

Server-side Stripe secrets (`stripe.secret`, `stripe.webhook_secret`) are stored via `firebase functions:config:set` — see `.env.example` for the full reference.

### 4. Run the Application
```bash
npm run dev
```

### 5. Deploy Firebase Functions
```bash
cd functions
npm install
npm run deploy
```

---

## Architecture

### Authentication
- Firebase Auth handles all user authentication
- User roles and metadata stored in the Firestore `users` collection
- Support for client and professional accounts

### Database — Firestore Collections
- `users` — User accounts and roles
- `professionals` — Tax professional public profiles
- `conversations` / `messages` — In-app messaging
- `gig_orders` — Marketplace gig orders
- `appointments` — Booked appointments
- `payments` — Stripe payment records
- `mail` — Outgoing email queue (Trigger Email extension)
- `admin_notifications` — Admin inbox

---

## Documentation
- **FIREBASE_SETUP.md** — Complete Firebase setup guide
- **FIREBASE_MIGRATION.md** — History of the Supabase → Firebase migration
- **FIREBASE_NOTIFICATIONS.md** — Email notification system
- **STRIPE_INTEGRATION.md** — Stripe + Stripe Connect integration
- **FIRESTORE_SECURITY_RULES.md** — Firestore rules reference

---

## Troubleshooting

**Login Issues**
1. Verify Email/Password is enabled in Firebase Authentication
2. Check that the user exists in Firebase Authentication
3. Ensure Firestore rules are published
4. Check the browser console for errors

**Professional Not Showing**
1. Verify the professional document exists in Firestore
2. Check that the document is published (`is_published: true`)
3. Ensure all required fields are present

**Email Not Sending**
1. Confirm the **Trigger Email** extension is installed and configured with SMTP/SendGrid
2. Check that documents are landing in the `mail` Firestore collection
3. Inspect the extension's logs in the Firebase Console

**`[supabase-stub]` warning in the console**
- This means a legacy code path is still calling the old Supabase stub. Open the file referenced in the warning and rewrite the call to use Firestore / Cloud Functions / Firebase Storage.

---

## Support

For issues or questions, check the Firebase Console logs (Functions, Firestore, Auth) and the browser console for detailed error messages.
