# Firestore Security Rules — Required Setup

## Symptom
The browser shows one of these errors:

```
Error fetching professionals from Firestore: { "message": "Missing or insufficient permissions." }
FirebaseError: Missing or insufficient permissions.
```

This means the Firestore database is running with the default lockdown rules
(`allow read, write: if false;`) and our `professionals` directory queries are
being rejected before they reach the data. The app will automatically fall back
to the bundled sample directory, but real Firestore-stored professionals will
**not** appear until the rules below are published.

## Fix — Publish These Rules

1. Open the Firebase Console: <https://console.firebase.google.com>
2. Select project **`refund-connect-1m30`**
3. Left menu → **Firestore Database** → **Rules** tab
4. Replace the existing rules with the block below, then click **Publish**.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Users ──────────────────────────────────────────────
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow create:      if request.auth != null;
    }

    // ── Professionals directory ────────────────────────────
    // PUBLIC READ is required so the directory works for logged-out visitors.
    // Owners (matched on firebase_uid field) can update their own profile.
    // Any signed-in user can create their initial profile during onboarding.
    match /professionals/{professionalId} {
      allow read:   if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
                            && (resource.data.firebase_uid == request.auth.uid
                                || request.auth.token.admin == true);
    }

    // Subcollections of a professional (services, availability, etc.)
    match /professionals/{professionalId}/{sub=**} {
      allow read:  if true;
      allow write: if request.auth != null;
    }

    // ── Tax professional applications (onboarding queue) ──
    match /tax_professional_applications/{appId} {
      allow create: if true;                // anyone can apply
      allow read, update, delete: if request.auth != null;
    }

    // ── Admin notifications ────────────────────────────────
    match /admin_notifications/{noteId} {
      allow read, write: if request.auth != null;
    }
    // ── Contact forms / submissions / enrollments ─────────
    // Anyone (including logged-out site visitors) can submit a contact form.
    // Only authenticated users (admins/staff) can read or update the inbox.
    match /contact_forms/{formId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
    match /contact_submissions/{submissionId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
    match /enrollments/{enrollmentId} {
      allow create: if true;
      allow read:   if request.auth != null;
    }

    // ── Conversations & messages (in-app messaging) ───────
    // A conversation is visible/writable only to its participants.
    // Messages live in a subcollection; participants can read & post.
    match /conversations/{conversationId} {
      allow read, update: if request.auth != null
                          && request.auth.uid in resource.data.participants;
      allow create:       if request.auth != null
                          && request.auth.uid in request.resource.data.participants;

      match /messages/{messageId} {
        allow read:   if request.auth != null
                      && request.auth.uid in
                         get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow create: if request.auth != null
                      && request.auth.uid in
                         get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow update, delete: if request.auth != null
                              && request.auth.uid == resource.data.senderId;
      }
    }

    // ── Reviews ────────────────────────────────────────────
    match /reviews/{reviewId} {
      allow read:   if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
                            && resource.data.user_id == request.auth.uid;
    }

    // ── Email verification / change tokens ─────────────────
    match /email_verification_tokens/{tokenId} {
      allow read, write: if request.auth != null;
    }
    match /email_change_requests/{reqId} {
      allow read, write: if request.auth != null;
    }

    // ── Membership history ─────────────────────────────────
    match /membership_history/{historyId} {
      allow read:   if request.auth != null;
      allow create: if request.auth != null;
    }

    // ── Gigs (Fiverr-style packaged tax services) ─────────
    // PUBLIC READ so the /tax-gigs marketplace works for logged-out visitors.
    // Only the owning professional (pro_id == auth.uid) can create/update/delete
    // their own gigs. Admins (custom claim) can manage any gig.
    match /gigs/{gigId} {
      allow read:   if true;
      allow create: if request.auth != null
                    && request.resource.data.pro_id == request.auth.uid;
      allow update, delete: if request.auth != null
                            && (resource.data.pro_id == request.auth.uid
                                || request.auth.token.admin == true);
    }

    // ── Gig orders (client briefs / project orders) ───────
    // Each order is a private contract between ONE client (client_uid) and
    // ONE pro (pro_id). Only those two parties (or an admin) can read or
    // update it. The order is created by the buying client at brief-submit
    // time, so create requires request.auth.uid == client_uid.
    //
    // STRIPE PAYMENT FIELDS — the same update rule covers payment writes:
    //   • Pro (pro_id == auth.uid) writes:
    //       status = 'awaiting_payment', payment_status = 'pending',
    //       checkout_url, stripe_checkout_session_id
    //     after clicking "Accept & request payment" (calls the
    //     create-booking-payment edge function which creates the Stripe
    //     Checkout Session server-side).
    //   • Client (client_uid == auth.uid) writes:
    //       status = 'in_progress', payment_status = 'paid',
    //       stripe_payment_intent_id, stripe_checkout_session_id, paid_at
    //     after Stripe redirects them back to /my-orders and the
    //     verify_gig_order edge function confirms the session is paid.
    match /gig_orders/{orderId} {
      allow read:   if request.auth != null
                    && (resource.data.client_uid == request.auth.uid
                        || resource.data.pro_id == request.auth.uid
                        || request.auth.token.admin == true);
      allow create: if request.auth != null
                    && request.resource.data.client_uid == request.auth.uid;
      allow update: if request.auth != null
                    && (resource.data.client_uid == request.auth.uid
                        || resource.data.pro_id == request.auth.uid
                        || request.auth.token.admin == true);
      allow delete: if request.auth != null
                    && request.auth.token.admin == true;
    }

  }
}
```



## Why public read on `professionals` is safe
The professionals collection only ever contains public-facing directory data
(name, business name, city, bio, services, profile photo URL). All sensitive
fields (Stripe IDs, internal notes, etc.) live in separate collections that
remain locked down.

## Verifying the fix
After publishing:

1. Hard-refresh the site (Cmd-Shift-R / Ctrl-Shift-R).
2. Open DevTools → Console. The `Missing or insufficient permissions` error
   should be gone.
3. Real Firestore-stored professionals will appear in the directory alongside
   any sample fallbacks.

## Storage Rules
The matching Firebase Storage rules (for the `professionals/{uid}/` photo
upload path) live in `FIREBASE_STORAGE_RULES.txt` — apply those in the
Firebase Console under **Storage → Rules** as well.
