# Admin Content — Role Segregation Testing

Verifies the requirement: **when an admin uploads a document for a specific role
group, it is assigned to that group and accessible only to that role.**

The four audience groups (see `src/constants/contentCategories.ts`):

| Group | Who resolves into it |
|---|---|
| `users` | role `client` |
| `professionals` | any `professional` (all tiers) |
| `associates` | professional whose `membershipLevel` is **Associate Partner** |
| `premium_partners` | professional whose `membershipLevel` is **Premier Partner** |

Gating is enforced at the database layer in `firestore.rules`
(`match /member_content/{docId}`), not just in the UI.

---

## 1. Automated rules tests (authoritative)

Test file: `tests/rules/memberContent.test.ts` (vitest +
`@firebase/rules-unit-testing`). It seeds one user per role + an admin and one
content doc per group, then asserts every (role × group) read outcome and that
only admins can write/delete.

```bash
# one-time
npm install

# run (boots the Firestore emulator, loads firestore.rules, runs the suite)
npm run test:rules:emu
```

Expected: all reads succeed only for the matching group (associates also read
`professionals`; premier also read `professionals`; admin reads all); every
non-admin write/delete fails.

> **Requirement:** the Firestore emulator in current `firebase-tools` needs
> **JDK 21+**. If you see *"firebase-tools no longer supports Java version
> before 21"*, install JDK 21 (or pin an older `firebase-tools`). Without the
> emulator the suite reports `ECONNREFUSED 127.0.0.1:8080` — that means the
> emulator isn't running, not that the tests are wrong.

If an emulator is already running elsewhere you can run just the suite:

```bash
npm run test:rules
```

---

## 2. Manual smoke test (end-to-end through the UI)

Seed one verified account per group (Admin SDK; see script header for the
`GOOGLE_APPLICATION_CREDENTIALS` / `NODE_PATH` setup):

```bash
NODE_PATH=functions/node_modules node scripts/seedRoleAccounts.mjs
```

Creates `client@test.com`, `pro@test.com`, `associate@test.com`,
`premier@test.com` (shared password `Test1234!`).

Then:

1. Sign in as the primary admin (`admin@gmail.com`) → **Admin Console →
   Content**. Upload a document and assign it to **Associates** only. Publish.
2. Sign in as `associate@test.com` → Member Portal → **Resources**: the document
   appears under the *Associates* section.
3. Sign in as `client@test.com`, `pro@test.com`, and `premier@test.com` in turn:
   the document must **not** appear for any of them.
4. Repeat assigning to **Users / Professionals / Premium Partners** and confirm
   only the matching account sees each.

A pass means each document is visible only to its assigned group.

---

## 3. Primary admin verification

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
NODE_PATH=functions/node_modules \
node scripts/seedPrimaryAdmin.mjs admin@gmail.com '<password>'
```

Then sign in as `admin@gmail.com`: it should land in the dark Admin Console with
`emailVerified` true and all sections visible (`admin@gmail.com` is also in
`BOOTSTRAP_ADMIN_EMAILS` + `firestore.rules`, so it self-promotes on login even
without the script).
