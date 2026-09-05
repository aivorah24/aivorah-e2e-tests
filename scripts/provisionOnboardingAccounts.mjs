// ONE-TIME provisioning script for the 7 Parent Onboarding E2E accounts
// (parent-onboard-1..6, student-onboard-linktarget - see tests/parent/
// onboarding.spec.js and tests/helpers/accounts.js).
//
// Every other E2E account was created by hand, once, via the real signup
// UI (see accounts.js's comments on parent-l/teacher-g). This script does
// the Firebase-Auth-account half of that same one-time act programmatically
// instead, using the Firebase Admin SDK service account that now exists
// locally (aivorah-auth-service/firebase-service-account.json) - then
// upserts the matching Supabase `users` row directly, the same
// direct-Supabase-admin pattern every other test helper in this repo uses
// (resetOnboarding.js, resetProfile.js, etc).
//
// Uses the SAME shared E2E_PASSWORD secret every other account logs in
// with (see accounts.js: `export const PASSWORD = process.env.E2E_PASSWORD`)
// - no new password secrets needed, only these 7 fixed emails (hardcoded in
// accounts.js, not secret-backed - see that file's comment on why).
//
// IDEMPOTENT: safe to re-run at any time.
//   - Firebase: skips creating a user whose email already exists.
//   - Supabase: always upserts the `users` row (onConflict: email) back to
//     the known-clean provisioning state (onboarding_complete: false), so
//     re-running this script also works as a "restore all 7 to fresh" reset
//     if one of them ever ends up in a bad state outside a normal test run.
//
// Usage: node scripts/provisionOnboardingAccounts.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname, '..', '..', 'aivorah-auth-service', 'firebase-service-account.json',
);

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`::error:: Firebase service account not found at ${SERVICE_ACCOUNT_PATH}`);
  console.error('This script needs aivorah-auth-service/firebase-service-account.json (gitignored, local-only).');
  process.exit(1);
}
if (!process.env.E2E_PASSWORD) {
  console.error('::error:: E2E_PASSWORD is required (same shared password every E2E account logs in with).');
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('::error:: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const firebaseAuth = getAuth();
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Explicit, not derived from accounts.js, so this script's intent is fully
// readable on its own and doesn't silently pick up unrelated future entries
// if accounts.js grows more onboarding accounts later.
const ACCOUNTS_TO_PROVISION = [
  { email: 'e2e.parent.onboard.1@aivorah.test', role: 'parent', name: 'E2E Parent Onboard 1 (FB1)' },
  { email: 'e2e.parent.onboard.2@aivorah.test', role: 'parent', name: 'E2E Parent Onboard 2 (FB2)' },
  { email: 'e2e.parent.onboard.3@aivorah.test', role: 'parent', name: 'E2E Parent Onboard 3 (FB3)' },
  { email: 'e2e.parent.onboard.4@aivorah.test', role: 'parent', name: 'E2E Parent Onboard 4 (FB4)' },
  { email: 'e2e.parent.onboard.5@aivorah.test', role: 'parent', name: 'E2E Parent Onboard 5 (FB5)' },
  { email: 'e2e.parent.onboard.6@aivorah.test', role: 'parent', name: 'E2E Parent Onboard 6 (FB6)' },
  { email: 'e2e.student.onboard.linktarget@aivorah.test', role: 'student', name: 'E2E Student Onboard Linktarget (FB5)' },
];

async function ensureFirebaseUser(email) {
  try {
    const existing = await firebaseAuth.getUserByEmail(email);
    console.log(`[firebase] ${email} already exists (uid ${existing.uid}) - skipping creation`);
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
  const created = await firebaseAuth.createUser({
    email,
    password: process.env.E2E_PASSWORD,
    emailVerified: true,
  });
  console.log(`[firebase] created ${email} (uid ${created.uid})`);
  return created.uid;
}

async function upsertSupabaseRow({ email, role }) {
  // Deliberately NO `name` here. A real brand-new parent has no saved name
  // until they type it into this exact onboarding form - OnboardingParentBoxes
  // initializes its Full Name field from `user?.name`
  // (useState(user?.name || '')), so seeding a name here would pre-fill that
  // field and silently defeat FB2 ("parent cannot finish without a name").
  // Found via a real FB2 run reaching the Dashboard despite the test never
  // typing a name - root-caused to this exact seeding, fixed here.
  const { error } = await supabaseAdmin.from('users').upsert(
    {
      email,
      name: '',
      role,
      school: 'TSRA',
      onboarding_complete: false,
    },
    { onConflict: 'email' },
  );
  if (error) throw new Error(`Supabase upsert failed for ${email}: ${error.message}`);
  console.log(`[supabase] ${email} -> role=${role}, onboarding_complete=false, name=''`);
}

let failed = 0;
for (const account of ACCOUNTS_TO_PROVISION) {
  try {
    await ensureFirebaseUser(account.email);
    await upsertSupabaseRow(account);
  } catch (err) {
    console.error(`::error:: Failed to provision ${account.email}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. ${ACCOUNTS_TO_PROVISION.length - failed}/${ACCOUNTS_TO_PROVISION.length} accounts provisioned.`);
if (failed > 0) process.exit(1);
