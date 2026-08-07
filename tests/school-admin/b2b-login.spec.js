// This file tests the SCHOOL ADMIN LOGIN screen (B2B demo account).
// Same login popup as student/teacher/parent - just a different account.
//
// We test 3 things (3 separate small tests, not one giant test):
// 1. Correct email + password -> admin reaches their Dashboard
// 2. Wrong password -> error message shows
// 3. Empty email/password -> "fill in all fields" message shows

import { test, expect } from '@playwright/test';

// Read the real login credentials from our .env file (never hardcoded here).
const ADMIN_EMAIL = process.env.B2B_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.B2B_ADMIN_PASSWORD;

// This little helper function does the repeated steps:
// 1. Open the app
// 2. Click "Login" (this button lives inside an iframe on the landing page)
// 3. Wait for the real Login popup (modal) to appear
async function openLoginModal(page) {
  // Go to the homepage (baseURL is already set to http://localhost:3006 in config)
  await page.goto('/');

  // The landing page shows an <iframe> with its own "Login" button inside it.
  // Playwright needs a special command (frameLocator) to "reach inside" an iframe.
  const landingFrame = page.frameLocator('iframe');
  await landingFrame.getByRole('button', { name: 'Login' }).click();

  // Clicking that button opens the REAL login popup, which lives OUTSIDE the iframe,
  // directly on the main page. We wait for its "Email address" field to appear.
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
}

test.describe('School Admin B2B Login', () => {
  // TEST 1: correct email + password should log the admin in
  test('correct login goes to admin dashboard', async ({ page }) => {
    await openLoginModal(page);

    // Type the email and password into the popup's input boxes
    await page.getByPlaceholder('you@example.com').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);

    // Click the "Sign In" button to submit the form.
    // Note: this app's buttons are custom-built (not real HTML <button> tags),
    // so we search by the visible text "Sign In" instead of by role="button".
    await page.getByText('Sign In', { exact: true }).click();

    // After a correct login, the sidebar shows "School Administrator" as the
    // signed-in user's role label - different text again from student/
    // teacher ("Good morning/afternoon/evening,") and parent ("Welcome,").
    //
    // The app renders two overlapping sidebar copies (mobile + desktop
    // layouts) - one is always hidden. Ask only for the visible copy.
    await expect(
      page.getByText('School Administrator').filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // TEST 2: wrong password should show an error, NOT log the admin in
  test('wrong password shows error message', async ({ page }) => {
    await openLoginModal(page);

    await page.getByPlaceholder('you@example.com').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('••••••••').fill('ThisIsTheWrongPassword123');
    await page.getByText('Sign In', { exact: true }).click();

    // The app shows either "Incorrect password." or "Invalid email or password."
    // depending on which error the server sends back - we accept either.
    await expect(page.getByText(/Incorrect password\.|Invalid email or password\./)).toBeVisible();
  });

  // TEST 3: leaving email and password empty should show a validation message
  test('empty fields shows validation message', async ({ page }) => {
    await openLoginModal(page);

    // We don't type anything - just click "Sign In" directly.
    await page.getByText('Sign In', { exact: true }).click();

    await expect(page.getByText('Please fill in all fields.')).toBeVisible();
  });
});
