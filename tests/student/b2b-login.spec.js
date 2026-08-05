// This file tests the STUDENT LOGIN screen (B2B demo account).
// "B2B" here just means: a student account created by a school (not self-signup).
//
// We test 3 things (3 separate small tests, not one giant test):
// 1. Correct email + password -> student reaches the Dashboard
// 2. Wrong password -> error message shows
// 3. Empty email/password -> "fill in all fields" message shows

import { test, expect } from '@playwright/test';

// Read the real login credentials from our .env file (never hardcoded here).
const STUDENT_EMAIL = process.env.B2B_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.B2B_STUDENT_PASSWORD;

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

test.describe('Student B2B Login', () => {
  // TEST 1: correct email + password should log the student in
  test('correct login goes to student dashboard', async ({ page }) => {
    await openLoginModal(page);

    // Type the email and password into the popup's input boxes
    await page.getByPlaceholder('you@example.com').fill(STUDENT_EMAIL);
    await page.getByPlaceholder('••••••••').fill(STUDENT_PASSWORD);

    // Click the "Sign In" button to submit the form.
    // Note: this app's buttons are custom-built (not real HTML <button> tags),
    // so we search by the visible text "Sign In" instead of by role="button".
    await page.getByText('Sign In', { exact: true }).click();

    // After a correct login, the Dashboard screen shows a greeting like
    // "Good morning, <Name>" or "Good afternoon, <Name>" as its title.
    // We just check that SOME greeting text appears - this proves login worked
    // without hardcoding the exact student name (which could change later).
    // Two elements can match this text at once (a placeholder version without
    // the name, then the real one with the name) - .first() just means
    // "whichever one shows up first is fine, we're only checking a greeting appeared".
    await expect(page.getByText(/Good (morning|afternoon|evening),/).first()).toBeVisible({
      timeout: 10000,
    });
  });

  // TEST 2: wrong password should show an error, NOT log the student in
  test('wrong password shows error message', async ({ page }) => {
    await openLoginModal(page);

    await page.getByPlaceholder('you@example.com').fill(STUDENT_EMAIL);
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
