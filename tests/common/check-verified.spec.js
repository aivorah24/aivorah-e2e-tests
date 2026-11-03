// This file tests the "waiting for email verification" screen (VerifyEmailScreen),
// which every role lands on right after signup - the screen behind
// GET /user/check-verified.
//
// Lives in tests/common because the endpoint and screen are identical for
// every role - nothing here branches by student/teacher/parent.
//
// We can't click a real verification link (no real inbox to read in a test),
// so we cover the two things that ARE testable:
// 1. The manual "I've Verified My Email" button, when the account genuinely
//    isn't verified yet - real UI, real server call, real (negative) answer.
// 2. What a real click on the email link looks like from the app's side: we
//    mark the account verified directly in Supabase (see
//    tests/helpers/markVerified.js) - the same database change the real
//    verify link makes - and confirm the screen's own 2-second poll picks
//    that up and auto-advances to onboarding, without us clicking anything.

import { test, expect } from '@playwright/test';
import { markEmailVerified } from '../helpers/markVerified.js';

async function openSignupModal(page) {
  await page.goto('/');
  const landingFrame = page.frameLocator('iframe');
  await landingFrame.getByRole('button', { name: 'Join Early Access' }).click();
  await expect(page.getByText('Create your account', { exact: true })).toBeVisible();
}

// Signs up a brand-new disposable student account and waits for the
// verification screen. Student is the default role chip, so no role needs
// to be picked - keeps this test focused on check-verified, not signup.
async function signUpAndReachVerifyScreen(page) {
  await openSignupModal(page);

  const email = `test.checkverified.${Date.now()}@aivorah.demo`;
  await page.getByPlaceholder('Jane Smith').fill('Check Verified Test');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByText('Select your date of birth').click();
  await page.getByText(/January \d{4}/).click();
  await page.getByText(String(new Date().getFullYear() - 16), { exact: true }).click();
  await page.getByText('15', { exact: true }).click();
  await page.getByPlaceholder('At least 6 characters').fill('validPass123');
  await page.getByText('Create Free Account', { exact: true }).click();

  await expect(page.getByText('Check your inbox')).toBeVisible({ timeout: 10000 });
  return email;
}

test.describe('Check Verified', () => {
  test('clicking "I\'ve Verified My Email" before actually verifying shows an error', async ({
    page,
  }) => {
    await signUpAndReachVerifyScreen(page);

    await page.getByText("I've Verified My Email", { exact: true }).click();

    await expect(
      page.getByText('Email not yet verified. Please check your inbox and click the activation link.'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('verifying (as the real link would) auto-advances to onboarding, no click needed', async ({
    page,
  }) => {
    const email = await signUpAndReachVerifyScreen(page);

    // This is the same database change GET /user/verify/:token makes when a
    // real person clicks the link in their email - we're simulating that
    // click, not the endpoint that would normally cause it.
    await markEmailVerified(email);

    // The screen polls check-verified every 2 seconds - give it enough time
    // to notice and move on by itself. Onboarding's first field ("Your name")
    // is the same marker onboarding.spec.js already relies on.
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible({ timeout: 15000 });
  });
});
