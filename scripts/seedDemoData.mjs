/**
 * seedDemoData.mjs — OPTIONAL demo data seeder.
 *
 * Populates the real Firestore collections that the dashboards now read from, so
 * you can SEE non-zero numbers immediately. Every document is written as the
 * signed-in user (so it satisfies the production security rules — no service
 * account needed). This is real data in your real database; delete it from the
 * Firebase console when you're done demoing.
 *
 * Collections written: reviews, gig_orders (paid), payments, profile_views,
 *                      course_enrollments, connections
 *
 * Usage (from the repo root):
 *   node scripts/seedDemoData.mjs you@example.com 'yourPassword'
 *
 * The account must already exist (sign up in the app first). For the platform
 * Analytics dashboard to show the data, that account's users/{uid}.role should
 * be 'admin'.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBjwKpTXm8bBr8oTEQkpaDBCPfm5ZVkl5k',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'refund-connect-1m30.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'refund-connect-1m30',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'refund-connect-1m30.firebasestorage.app',
  messagingSenderId: '540713290869',
  appId: '1:540713290869:web:9b2358f3ab18da4072fc3c',
};

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/seedDemoData.mjs <email> <password>');
  process.exit(1);
}

const GIGS = [
  { title: 'Individual Tax Return (1040)', price: 250 },
  { title: 'Small Business Tax Filing', price: 600 },
  { title: 'Bookkeeping (Monthly)', price: 350 },
  { title: 'Tax Consulting Session', price: 150 },
  { title: 'Audit Support', price: 800 },
];
const CLIENTS = ['Alex Rivera', 'Jamie Chen', 'Morgan Lee', 'Taylor Brooks', 'Sam Patel'];

const daysAgo = (n) => Timestamp.fromDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Signing in as ${email}…`);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  console.log(`✓ Signed in (uid=${uid})`);

  let counts = { reviews: 0, gig_orders: 0, payments: 0, profile_views: 0, course_enrollments: 0, connections: 0 };

  // Spread activity across the last ~165 days so the 6-month trend charts fill in.
  for (let i = 0; i < 18; i++) {
    const when = daysAgo(Math.floor(Math.random() * 165));
    const gig = rand(GIGS);

    // Paid gig order → drives bookings, revenue, popular services, retention.
    await addDoc(collection(db, 'gig_orders'), {
      client_uid: uid,
      pro_id: uid,
      client_name: rand(CLIENTS),
      gig_title: gig.title,
      tier: { name: 'Standard', price: gig.price },
      price: gig.price,
      status: 'completed',
      payment_status: 'paid',
      created_at: when,
      paid_at: when,
    });
    counts.gig_orders++;

    // Matching payment record → Payments tab + revenue.
    await addDoc(collection(db, 'payments'), {
      user_uid: uid,
      amount: gig.price,
      currency: 'usd',
      status: 'succeeded',
      paymentType: 'service_fee',
      description: gig.title,
      created_at: when,
    });
    counts.payments++;
  }

  // Reviews across 6 months → average rating + ratings-over-time.
  for (let i = 0; i < 14; i++) {
    await addDoc(collection(db, 'reviews'), {
      professional_id: uid,
      client_id: uid,
      client_name: rand(CLIENTS),
      rating: 4 + Math.round(Math.random()),
      title: 'Great experience',
      review_text: 'Professional, fast, and thorough. Highly recommend.',
      is_verified: true,
      helpful_count: 0,
      not_helpful_count: 0,
      created_at: daysAgo(Math.floor(Math.random() * 165)),
    });
    counts.reviews++;
  }

  // Profile views → conversion funnel.
  for (let i = 0; i < 40; i++) {
    await addDoc(collection(db, 'profile_views'), {
      pro_id: uid,
      source: 'directory',
      created_at: daysAgo(Math.floor(Math.random() * 30)),
    });
    counts.profile_views++;
  }

  // Course enrollments → member dashboard "Courses" tile.
  for (const [title, status] of [
    ['2024 Tax Law Update', 'completed'],
    ['Ethics for Tax Professionals', 'in_progress'],
    ['Advanced Schedule C', 'enrolled'],
  ]) {
    await addDoc(collection(db, 'course_enrollments'), {
      user_id: uid,
      course_id: title.toLowerCase().replace(/\s+/g, '-'),
      course_title: title,
      status,
      progress: status === 'completed' ? 100 : status === 'in_progress' ? 45 : 0,
      created_at: daysAgo(Math.floor(Math.random() * 60)),
      updated_at: daysAgo(Math.floor(Math.random() * 10)),
    });
    counts.course_enrollments++;
  }

  console.log('✓ Seed complete:', counts);
  console.log('Open the Member Portal → Analytics (admin) and Dashboard to see live numbers.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err?.message || err);
  process.exit(1);
});
