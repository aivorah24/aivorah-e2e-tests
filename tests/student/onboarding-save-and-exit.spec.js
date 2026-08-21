// Regression test for a reported bug: a student fills in part of the
// onboarding form (name + school), taps Back, and confirms "Save & go to
// home page". They're signed out as expected — but signing back in showed
// the WRONG name (something derived from their email/Google account instead
// of what they'd actually typed) and the school field came back empty.
//
// Root cause (fixed alongside this test):
// 1. saveProgress() in OnboardingStudentBoxes.tsx was PATCHing /user/profile
//    on the old monolith (SERVER_URL) instead of the migrated profile
//    microservice (PROFILE_SERVER_URL), with no response-status check at
//    all — a failed save was silent.
// 2. AuthContext's signInWithGoogle() built the session's `name` from
//    Firebase's displayName/email BEFORE the saved Supabase profile was
//    even fetched, so a returning user's real saved name was always
//    overwritten on next login regardless of whether the save above worked.
//
// This spec only re-verifies (1) — the partial-save-then-reload round trip —
// since it drives login via email/password (see tests/helpers/auth.js for
// why: Google's real OAuth popup isn't something this harness automates).
// (2) is Google-SSO-specific and is covered by a dedicated unit test in the
// frontend repo (src/context/__tests__/AuthContext.googleSignIn.test.tsx),
// which reproduces the exact same "name reverts on reload" failure against
// the actual signInWithGoogle code path.

import { test, expect } from '@playwright/test';
import { resetOnboarding } from '../helpers/resetOnboarding.js';
import { accountFor } from '../helpers/accounts.js';
import { newPageAs } from '../helpers/session.js';

const ACCOUNT = 'student-d10';
const TYPED_NAME = 'Progress Saver';
const TYPED_SCHOOL = 'The Progress Academy';

test.describe('Student Onboarding — Save & Exit persists partial progress', () => {
  test('name and school typed before Save & Exit are still there after signing back in', async ({
    browser,
  }) => {
    await resetOnboarding(accountFor(ACCOUNT).email);

    // ── Session 1: fill part of the form, then Save & Exit ──────────────
    const page1 = await newPageAs(browser, ACCOUNT);
    await page1.goto('/');

    await page1.getByRole('textbox', { name: 'Your name' }).fill(TYPED_NAME);
    const schoolInput = page1.getByRole('textbox', { name: 'Type your school name (e.g.' });
    await schoolInput.click();
    await schoolInput.fill(TYPED_SCHOOL);

    // Deliberately leave curriculum/grade/location empty — this is the
    // "left mid-form" scenario the bug report described.
    await page1.getByLabel('Back to home page').click();
    await expect(page1.getByText('Return to the home page?')).toBeVisible();
    await page1.getByText('Save & go to home page').click();

    // Signed out → back on the public landing page.
    await expect(page1.getByPlaceholder('you@example.com')).toBeVisible({ timeout: 10000 });

    // ── Session 2: sign back in, land back on the (still incomplete) form ──
    const page2 = await newPageAs(browser, ACCOUNT);
    await page2.goto('/');

    // Confirms the actual reported bug is fixed: the name field must show
    // what was TYPED, never something derived from the account's email.
    await expect(page2.getByRole('textbox', { name: 'Your name' })).toHaveValue(TYPED_NAME, {
      timeout: 10000,
    });
    await expect(
      page2.getByRole('textbox', { name: 'Type your school name (e.g.' }),
    ).toHaveValue(TYPED_SCHOOL);
  });
});
