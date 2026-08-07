// Marks an account's email as verified, directly in Supabase - same effect
// as the person actually clicking the link in their verification email.
//
// We can't click a real email link in a test (no real inbox to read), so this
// does what /user/verify/:token does on the database side: set accountStatus
// to 'active'. That's exactly what the app's own 2-second poll on
// VerifyEmailScreen is watching for - so after calling this, the real app
// code detects it and auto-advances to onboarding, same as a genuine click
// would.
//
// Talks DIRECTLY to Supabase with an admin key, same pattern as
// resetOnboarding.js / resetProfile.js - bypasses the app on purpose, the way
// a developer running a SQL script would.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function markEmailVerified(email) {
  const { data: existing, error: readError } = await supabaseAdmin
    .from('user_preferences')
    .select('data')
    .eq('user_email', email.toLowerCase())
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read user_preferences for ${email}: ${readError.message}`);
  }

  const merged = { ...(existing?.data ?? {}), accountStatus: 'active', verifyToken: null, verifyTokenExpiry: null };

  const { error: writeError } = await supabaseAdmin
    .from('user_preferences')
    .upsert({ user_email: email.toLowerCase(), data: merged }, { onConflict: 'user_email' });

  if (writeError) {
    throw new Error(`Failed to mark ${email} verified: ${writeError.message}`);
  }
}
