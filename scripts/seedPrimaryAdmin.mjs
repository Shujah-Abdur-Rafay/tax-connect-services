/**
 * seedPrimaryAdmin.mjs — one-time PRIMARY ADMIN bootstrap (Firebase Admin SDK).
 *
 * Makes `admin@gmail.com` (or any email you pass) a fully-verified platform
 * admin. This does the ONE thing the client app cannot do: flip the Firebase
 * Auth `emailVerified` flag. It also promotes the account to role 'admin' in
 * Firestore and (optionally) sets an `{ admin: true }` custom claim.
 *
 * The email is also listed in BOTH:
 *   - src/services/adminManagementService.ts  → BOOTSTRAP_ADMIN_EMAILS
 *   - firestore.rules                          → isBootstrapAdminEmail()
 * so even without this script, the account self-elevates to admin on next login.
 * This script additionally guarantees emailVerified === true up-front.
 *
 * ── Requirements ────────────────────────────────────────────────────────────
 * Admin SDK credentials. Use a service-account key from the Firebase console
 * (Project settings → Service accounts → Generate new private key) and point
 * GOOGLE_APPLICATION_CREDENTIALS at it. firebase-admin ships in functions/, so
 * resolve it via NODE_PATH.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 * Bash:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   NODE_PATH=functions/node_modules \
 *   node scripts/seedPrimaryAdmin.mjs admin@gmail.com 'StrongPassw0rd!'
 *
 * PowerShell:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="./serviceAccount.json"
 *   $env:NODE_PATH="functions/node_modules"
 *   node scripts/seedPrimaryAdmin.mjs admin@gmail.com 'StrongPassw0rd!'
 *
 * The password is only used if the account does not exist yet (to create it).
 * If the account already exists, the password argument is ignored.
 */

// firebase-admin ships in functions/node_modules. Resolve it from there via a
// createRequire rooted at functions/ (works regardless of cwd / NODE_PATH).
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve as pathResolve } from 'path';
const __here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(pathToFileURL(pathResolve(__here, '../functions/package.json')));
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'refund-connect-1m30';

const [, , emailArg, passwordArg] = process.argv;
const email = (emailArg || 'admin@gmail.com').trim().toLowerCase();
const password = passwordArg || process.env.SEED_ADMIN_PASSWORD || '';

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`✖ Invalid email: "${email}"`);
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth();
const db = admin.firestore();

async function main() {
  let userRecord;

  // 1. Find or create the Auth user.
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`• Found existing auth user ${email} (uid ${userRecord.uid})`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      if (!password) {
        console.error(
          `✖ ${email} does not exist and no password was supplied to create it.\n` +
            `  Re-run with a password: node scripts/seedPrimaryAdmin.mjs ${email} '<password>'`,
        );
        process.exit(1);
      }
      userRecord = await auth.createUser({
        email,
        password,
        emailVerified: true,
        displayName: 'Administrator',
      });
      console.log(`• Created auth user ${email} (uid ${userRecord.uid})`);
    } else {
      throw err;
    }
  }

  // 2. Force-verify the email + set the admin custom claim (Admin-SDK only).
  await auth.updateUser(userRecord.uid, { emailVerified: true });
  await auth.setCustomUserClaims(userRecord.uid, {
    ...(userRecord.customClaims || {}),
    admin: true,
  });
  console.log('• emailVerified = true, custom claim { admin: true } set');

  // 3. Upsert the Firestore profile with role 'admin'.
  await db.collection('users').doc(userRecord.uid).set(
    {
      email,
      name: userRecord.displayName || 'Administrator',
      role: 'admin',
      emailVerified: true,
      isPrimaryAdmin: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  console.log("• users/" + userRecord.uid + " upserted with role 'admin'");

  console.log(`\n✔ ${email} is now a verified primary admin.`);
  console.log('  (The user must sign out / sign in again to pick up the new claim.)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✖ Seed failed:', err.message || err);
    process.exit(1);
  });
