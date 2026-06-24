/**
 * seedRoleAccounts.mjs — seed one verified TEST account per content group.
 *
 * The Admin Content Management module assigns each document to one or more of
 * four audience groups (see src/constants/contentCategories.ts):
 *   users | professionals | associates | premium_partners
 *
 * To exercise document-sharing end-to-end you need a real account that resolves
 * into each group. getUserContentCategories() derives the group from
 * role + membershipLevel, so this script creates:
 *
 *   client@test.com     role 'client'                                   → Users
 *   pro@test.com        role 'professional', Free Directory Listing     → Professionals
 *   associate@test.com  role 'professional', 'Associate Partner'        → Associates
 *   premier@test.com    role 'professional', 'Premier Partner'          → Premium Partners
 *
 * Each is created (or updated) with emailVerified = true so it can sign in and
 * read content immediately.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 * Bash:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   NODE_PATH=functions/node_modules \
 *   node scripts/seedRoleAccounts.mjs            # default password Test1234!
 *   node scripts/seedRoleAccounts.mjs 'MyPassw0rd!'   # custom shared password
 *
 * PowerShell:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="./serviceAccount.json"
 *   $env:NODE_PATH="functions/node_modules"
 *   node scripts/seedRoleAccounts.mjs
 *
 * These are throwaway demo accounts — delete them from the Firebase console
 * (Auth + the users collection) when you are done testing.
 */

// firebase-admin ships in functions/. ESM `import` does NOT honor NODE_PATH, so
// resolve it through createRequire (CommonJS resolution, which does) — that's
// why the run command sets NODE_PATH=functions/node_modules.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'refund-connect-1m30';
const PASSWORD = (process.argv[2] || process.env.SEED_PASSWORD || 'Test1234!').trim();

// Each account + the group it should resolve into (for the console log).
const ACCOUNTS = [
  { email: 'client@test.com', name: 'Test Client', role: 'client', membershipLevel: null, group: 'Users' },
  { email: 'pro@test.com', name: 'Test Pro', role: 'professional', membershipLevel: 'Free Directory Listing', group: 'Professionals' },
  { email: 'associate@test.com', name: 'Test Associate', role: 'professional', membershipLevel: 'Associate Partner', group: 'Associates' },
  { email: 'premier@test.com', name: 'Test Premier', role: 'professional', membershipLevel: 'Premier Partner', group: 'Premium Partners' },
];

admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth();
const db = admin.firestore();

async function ensureAccount({ email, name, role, membershipLevel, group }) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { emailVerified: true, displayName: name });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      user = await auth.createUser({ email, password: PASSWORD, emailVerified: true, displayName: name });
    } else {
      throw err;
    }
  }

  const profile = {
    email,
    name,
    role,
    emailVerified: true,
    updatedAt: new Date().toISOString(),
  };
  if (membershipLevel) profile.membershipLevel = membershipLevel;

  await db.collection('users').doc(user.uid).set(profile, { merge: true });
  console.log(`• ${email.padEnd(20)} role=${role.padEnd(13)} group=${group}`);
}

async function main() {
  console.log(`Seeding ${ACCOUNTS.length} role accounts (shared password: ${PASSWORD})\n`);
  for (const acct of ACCOUNTS) {
    await ensureAccount(acct);
  }
  console.log('\n✔ Role accounts ready. Sign in as each to verify per-group content visibility.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✖ Seed failed:', err.message || err);
    process.exit(1);
  });
