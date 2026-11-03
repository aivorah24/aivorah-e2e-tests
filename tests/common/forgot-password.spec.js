// This file tests the FORGOT PASSWORD popup.
//
// It lives in tests/common (not under a persona folder like student/teacher)
// because it's the exact same modal and code path for every role - the popup
// doesn't even know which role the account belongs to.
//
// We test 1 thing: entering an email and clicking "Send Reset Link" shows the
// "Reset link sent" confirmation.

import { test, expect } from '@playwright/test';

test.describe('Forgot Password', () => {
  test('valid email shows the reset link sent confirmation', async ({ page }) => {
    await page.goto('/');

    // The "Login" button lives inside an iframe on the landing page.
    const landingFrame = page.frameLocator('iframe');
    await landingFrame.getByRole('button', { name: 'Login' }).click();

    // "Forgot password?" is a link inside the Login popup.
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await page.getByText('Forgot password?', { exact: true }).click();

    // The real Forgot Password popup opens with its own title.
    await expect(page.getByText('Reset your password', { exact: true })).toBeVisible();

    const email = 'forgot.password.test@aivorah.demo';
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByText('Send Reset Link', { exact: true }).click();

    // Longer timeout than usual - this endpoint makes real Firebase Admin +
    // email API calls (no mocking), so it's genuinely slower than most of our
    // other assertions, especially right after a server restart (cold start).
    await expect(page.getByText(`Reset link sent to ${email}. Check your inbox.`)).toBeVisible({
      timeout: 20000,
    });
  });
});
