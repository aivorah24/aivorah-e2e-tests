// Removes ONE parent_children link row - used by
// tests/parent/onboarding.spec.js's FB5 (parent links an existing 14+
// account instead of creating a new one) to unlink parent-onboard-5 from
// student-onboard-linktarget after each run, so the link-target account is
// back to "unlinked" for the next run/worker.
//
// Deletes ONLY by (parent_email, child's email) - not by parent_email
// alone - so this can never remove a different child's link even if
// parent-onboard-5 somehow had more than one (it shouldn't, but scoping
// tightly costs nothing and matches the "only this exact relationship"
// requirement for FB5's cleanup).
//
// Same direct-Supabase-admin pattern as the other reset/cleanup helpers.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function deleteParentChildLink(parentEmail, childEmail) {
  const { data: child, error: childError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', childEmail.toLowerCase().trim())
    .maybeSingle();

  if (childError) {
    throw new Error(`Failed to look up child ${childEmail}: ${childError.message}`);
  }
  if (!child) {
    // Nothing to unlink - link was never created (e.g. the test failed
    // before reaching the link step). Not an error.
    return 0;
  }

  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from('parent_children')
    .delete()
    .eq('parent_email', parentEmail.toLowerCase().trim())
    .eq('child_id', child.id)
    .select('child_id');

  if (deleteError) {
    throw new Error(`Failed to delete parent_children link (${parentEmail} -> ${childEmail}): ${deleteError.message}`);
  }
  return deleted?.length || 0;
}
