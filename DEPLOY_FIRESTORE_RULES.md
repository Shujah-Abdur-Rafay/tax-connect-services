# Deploying Firestore Security Rules (REQUIRED)

> **TL;DR** — Editing `firestore.rules` in the repo does nothing until you
> **deploy** it. Firestore enforces the *deployed* ruleset, not the file on disk.
> If the deployed rules are out of date, tax-pro onboarding fails — at the
> **Save Profile** step OR the final **Sign Agreement** step — with
> `Missing or insufficient permissions` even though `firestore.rules` looks
> correct.

---

## ✅ Fix it now — 3 commands

The recurring `Missing or insufficient permissions` errors are caused by the
**deployed** ruleset being out of date. The rules in `firestore.rules` on disk
are already correct; they were just never pushed to Firebase. Run these once:

```bash
# 1. Install the Firebase CLI (one time, global)
npm install -g firebase-tools

# 2. Authenticate (opens a browser; choose the Google account
#    that owns the refund-connect-1m30 project)
firebase login

# 3. Deploy the rules to production
firebase deploy --only firestore:rules --project refund-connect-1m30
#    …or use the bundled npm shortcut (same thing):
npm run deploy:rules
```

Expected CLI output ends with:

```
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

The moment that prints, retry onboarding — the profile save **and** the
agreement-signing save both succeed server-side.

### Collections this deploy unblocks

The deployed ruleset must include match blocks for every collection onboarding
writes to. The repo's `firestore.rules` already covers all three of the ones
that were failing — deploying it makes onboarding saves succeed server-side:

| Collection | What writes it | Rule in `firestore.rules` |
|---|---|---|
| **`professionals/{uid}`** | `handleProfileSave` — the applicant's profile (doc id = their own uid) | `allow create, update, delete: if isSignedIn() && request.auth.uid == proId;` |
| **`signed_agreements/{id}`** | `handleAgreementSigned` — the immutable signed-agreement audit record | `allow create: if isSignedIn();` (read for admins; never updatable/deletable) |
| **`onboarding_reminders/{uid}`** | the scheduled reminder function's dedup ledger | `allow read: if true; allow create: if true; allow update, delete: if false;` |

> If any of these blocks is missing from the **deployed** ruleset (Firebase
> Console → Firestore → Rules), that collection's write is rejected with
> `Missing or insufficient permissions` regardless of what the repo says.
> Deploying the repo file (above) installs all three.

---


## Production project

| | |
|---|---|
| **Project ID** | `refund-connect-1m30` |
| **Rules file** | `firestore.rules` (repo root) |
| **Configured in** | `firebase.json` → `"firestore": { "rules": "firestore.rules" }` and `.firebaserc` → default `refund-connect-1m30` |

## One-time setup

```bash
npm install -g firebase-tools     # install the Firebase CLI
firebase login                    # authenticate (interactive)
# CI / non-interactive: export FIREBASE_TOKEN=<token from `firebase login:ci`>
```

## Deploy the rules

Pick any of the following (all target `refund-connect-1m30`):

```bash
# Recommended: deploy AND verify the live ruleset matches the repo
npm run rules:verify

# Just deploy the rules
npm run deploy:rules
# equivalent to:
firebase deploy --only firestore:rules --project refund-connect-1m30

# Deploy rules + indexes together
npm run deploy:firestore
```

To verify without deploying (diff live ruleset against the repo file):

```bash
bash deploy-firestore-rules.sh --verify-only
```

## Automatic deploy on every push (CI)

You no longer have to remember to deploy manually. The GitHub Actions workflow
**`.github/workflows/deploy-firestore-rules.yml`** runs
`firebase deploy --only firestore:rules --project refund-connect-1m30`
automatically whenever `firestore.rules` (or `firestore.indexes.json` /
`firebase.json`) changes on the **main** branch, and then verifies that the live
ruleset matches the repo. This guarantees the deployed rules never drift from
the repo.

**One-time setup — add the `FIREBASE_TOKEN` secret:**

```bash
firebase login:ci          # prints a CI token
```

Then in GitHub: **Settings → Secrets and variables → Actions → New repository
secret**, name it `FIREBASE_TOKEN`, and paste the token. You can also trigger
the workflow on demand from the **Actions** tab via *Run workflow*
(`workflow_dispatch`).


## Verify the deploy worked

1. **Console:** open
   <https://console.firebase.google.com/project/refund-connect-1m30/firestore/rules>
   and confirm the `professionals/{proId}` block is present:

   ```
   match /professionals/{proId} {
     allow read: if true;
     allow create, update, delete: if isSignedIn() && request.auth.uid == proId;
   }
   ```

2. **End-to-end:** sign in as a tax-pro applicant and complete the onboarding
   **Profile** step. The write to `professionals/{uid}` should now succeed
   instead of throwing `Missing or insufficient permissions`.

## Why this fixes the onboarding error

`TaxProfessionalOnboarding.tsx` → `handleProfileSave` writes the applicant's
profile to `professionals/{user.uid}`. That write is only allowed by the
`professionals/{proId}` rule in `firestore.rules`. If the **deployed** rules
predate that block (or any other rule the app relies on), Firestore rejects the
write regardless of what the repo says — so the rules must be redeployed after
every change.

> The app also force-refreshes the Firebase ID token and retries once on a
> permission error (see `ensureFreshAuth` in `TaxProfessionalOnboarding.tsx`),
> which covers the *expired-token* cause. Deploying the rules covers the
> *stale-deployed-rules* cause. Both are needed.
