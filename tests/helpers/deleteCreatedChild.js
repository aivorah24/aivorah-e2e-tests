// Cleans up a student account created by the parent-onboarding "auto-create
// a child under 14" flow (see OnboardingParentBoxes.tsx's
// `/parent/children/init-auth` + `/parent/:email/children/link-created`
// calls) — used by switch-profile.spec.js after the "Also a parent?" test.
//
// Why this exists separately from resetProfile.js's generic snapshot/
// restore: that mechanism only covers the PARENT's own `users` row and
// `user_preferences` blob (restored automatically by runTeardown.js for
// every mutable account). The CHILD is a brand-new row this test itself
// creates — nothing else knows to clean it up, so without this helper every
// test run would leave one more orphaned student account behind.
//
// Same direct-Supabase-admin pattern as resetOnboarding.js/resetProfile.js:
// bypasses the app with the service role key, safe only because that key
// lives in e2e/.env and is never used in real app code.
//
// ALSO deletes the real Firebase Auth user created during onboarding (via
// `createUserWithEmailAndPassword`) - a prior version of this helper didn't
// (no Firebase Admin SDK access existed yet), which was proven to be a real
// retry-safety bug, not just cosmetic debris: `init-auth`'s auto-generated
// login draws from a small sequential pool, so a Supabase-only cleanup frees
// the email for reuse while Firebase still holds it, and the NEXT run's
// createUserWithEmailAndPassword call fails with auth/email-already-in-use.
// Found via a real FB3 retry collision, 2026-09-05.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function firebaseAuth() {
  if (!getApps().length) {
    const svcPath = path.resolve(__dirname, '..', '..', '..', 'aivorah-auth-service', 'firebase-service-account.json');
    if (!fs.existsSync(svcPath)) return null;
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(svcPath, 'utf8'))) });
  }
  return getAuth();
}

async function deleteFirebaseUserByEmail(email) {
  const auth = firebaseAuth();
  if (!auth || !email) return;
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      console.warn(`[deleteCreatedChild] could not delete Firebase user ${email}: ${err.message}`);
    }
  }
}

// Deletes every child linked to this parent email whose name matches the
// given prefix (the test uses a unique-per-run name so this can never touch
// a real/other test's data). Also removes the parent_children link row.
export async function deleteCreatedChildrenByNamePrefix(parentEmail, namePrefix) {
  const { data: links, error: linksError } = await supabaseAdmin
    .from('parent_children')
    .select('child_id, users:child_id(id, name, email)')
    .eq('parent_email', parentEmail);

  if (linksError) {
    throw new Error(`Failed to read parent_children for ${parentEmail}: ${linksError.message}`);
  }

  const toDelete = (links ?? []).filter((l) => l.users?.name?.startsWith(namePrefix));

  for (const link of toDelete) {
    const { error: linkDeleteError } = await supabaseAdmin
      .from('parent_children')
      .delete()
      .eq('parent_email', parentEmail)
      .eq('child_id', link.child_id);
    if (linkDeleteError) {
      throw new Error(`Failed to delete parent_children row for child ${link.child_id}: ${linkDeleteError.message}`);
    }

    const { error: userDeleteError } = await supabaseAdmin.from('users').delete().eq('id', link.child_id);
    if (userDeleteError) {
      throw new Error(`Failed to delete child user row ${link.child_id}: ${userDeleteError.message}`);
    }

    await deleteFirebaseUserByEmail(link.users?.email);
  }

  return toDelete.length;
}
