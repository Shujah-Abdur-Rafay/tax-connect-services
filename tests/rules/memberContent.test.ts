// ============================================================================
// memberContent.test.ts — Firestore security-rules tests for role-based
// document segregation (Admin Content Management module).
//
// Proves the requirement: when an admin uploads a document for a specific role
// group, it is readable ONLY by accounts in that group, and only admins can
// write content. Runs against the Firestore emulator with the real
// firestore.rules loaded.
//
// Run:  firebase emulators:exec --only firestore "npm run test:rules"
//
// The four audience groups + how a user resolves into them (see
// src/constants/contentCategories.ts → getUserContentCategories):
//   users            → role 'client'
//   professionals    → role 'professional' (ANY tier)
//   associates       → professional whose membershipLevel is Associate Partner
//   premium_partners → professional whose membershipLevel is Premier Partner
// ============================================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'taxconnect-rules-test';
const HOST = '127.0.0.1';
const PORT = 8080;

// Seed users (uid → users/{uid} doc) — one per role/group + an admin.
const USERS: Record<string, { role: string; membershipLevel?: string; email: string }> = {
  client1: { role: 'client', email: 'client@test.com' },
  pro1: { role: 'professional', membershipLevel: 'Free Directory Listing', email: 'pro@test.com' },
  assoc1: { role: 'professional', membershipLevel: 'Associate Partner', email: 'associate@test.com' },
  prem1: { role: 'professional', membershipLevel: 'Premier Partner', email: 'premier@test.com' },
  admin1: { role: 'admin', email: 'admin@gmail.com' },
};

// One content doc per group.
const CONTENT: Record<string, { categories: string[] }> = {
  doc_users: { categories: ['users'] },
  doc_pros: { categories: ['professionals'] },
  doc_assoc: { categories: ['associates'] },
  doc_prem: { categories: ['premium_partners'] },
};

// Expected readable docs per uid (everything else must be denied).
const EXPECTED_READS: Record<string, string[]> = {
  client1: ['doc_users'],
  pro1: ['doc_pros'],
  assoc1: ['doc_pros', 'doc_assoc'],
  prem1: ['doc_pros', 'doc_prem'],
  admin1: ['doc_users', 'doc_pros', 'doc_assoc', 'doc_prem'],
};

let testEnv: RulesTestEnvironment;

const authed = (uid: string) =>
  testEnv.authenticatedContext(uid, { email: USERS[uid].email }).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: HOST,
      port: PORT,
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed users + content with rules bypassed.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, data] of Object.entries(USERS)) {
      await setDoc(doc(db, 'users', uid), data);
    }
    for (const [id, data] of Object.entries(CONTENT)) {
      await setDoc(doc(db, 'member_content', id), {
        title: id,
        ...data,
        is_published: true,
        type: 'link',
        url: 'https://example.com',
      });
    }
  });
});

describe('member_content read segregation', () => {
  for (const uid of Object.keys(USERS)) {
    const allowed = EXPECTED_READS[uid];
    for (const contentId of Object.keys(CONTENT)) {
      const shouldRead = allowed.includes(contentId);
      it(`${uid} ${shouldRead ? 'CAN' : 'cannot'} read ${contentId}`, async () => {
        const ref = doc(authed(uid), 'member_content', contentId);
        if (shouldRead) {
          await assertSucceeds(getDoc(ref));
        } else {
          await assertFails(getDoc(ref));
        }
      });
    }
  }

  it('an unauthenticated user cannot read any content', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'member_content', 'doc_users')));
    await assertFails(getDoc(doc(db, 'member_content', 'doc_pros')));
  });
});

describe('member_content write authorization', () => {
  it('admin CAN create content', async () => {
    const ref = doc(authed('admin1'), 'member_content', 'new_doc');
    await assertSucceeds(
      setDoc(ref, { title: 'x', categories: ['users'], is_published: true, type: 'link', url: 'u' }),
    );
  });

  for (const uid of ['client1', 'pro1', 'assoc1', 'prem1']) {
    it(`${uid} cannot create content`, async () => {
      const ref = doc(authed(uid), 'member_content', `blocked_${uid}`);
      await assertFails(
        setDoc(ref, { title: 'x', categories: ['users'], is_published: true, type: 'link', url: 'u' }),
      );
    });

    it(`${uid} cannot delete content`, async () => {
      const { deleteDoc } = await import('firebase/firestore');
      await assertFails(deleteDoc(doc(authed(uid), 'member_content', 'doc_users')));
    });
  }
});
