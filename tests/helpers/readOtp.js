// Reads a real email-verification OTP code straight out of the `otp_codes`
// Supabase table (see ai-mentor/server/services/otpStore.js) - the same
// table the real /email-otp/send and /email-otp/verify routes use. This is
// the ONLY way an E2E test can complete the child-email-verification flow
// in tests/parent/onboarding.spec.js's FB6, since there is no inbox this
// suite can read.
//
// Same direct-Supabase-admin pattern as resetOnboarding.js/resetProfile.js:
// bypasses the app with the service role key, safe only because that key
// lives in .env and is never used in real app code.
//
// Scoped by BOTH email and purpose (not just email) so a parallel worker's
// unrelated OTP (e.g. a password-reset code for a different flow that
// happens to share the 'email_verify' purpose on a different email, or a
// different purpose on the same email) can never be picked up by mistake -
// matches exactly how otpStore.getOtp(email, purpose) itself looks the row
// up on the server side.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function readOtp(email, purpose = 'email_verify') {
  const { data, error } = await supabaseAdmin
    .from('otp_codes')
    .select('otp')
    .eq('email', email.toLowerCase().trim())
    .eq('purpose', purpose)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read otp_codes for ${email} (${purpose}): ${error.message}`);
  }
  if (!data) {
    throw new Error(`No OTP found for ${email} (${purpose}) - was /email-otp/send called first?`);
  }
  return data.otp;
}

// Deletes the OTP row so a re-run of the same test doesn't read a stale
// code left over from a previous (possibly failed) attempt.
export async function deleteOtp(email, purpose = 'email_verify') {
  const { error } = await supabaseAdmin
    .from('otp_codes')
    .delete()
    .eq('email', email.toLowerCase().trim())
    .eq('purpose', purpose);

  if (error) {
    throw new Error(`Failed to delete otp_codes for ${email} (${purpose}): ${error.message}`);
  }
}
