// Student Subscription screen (legacy SubscriptionScreen.tsx) — plan selection
// (Free / Pro / Max) and upgrade flow. Legacy screen; payment is via Razorpay.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Three plans: Free (₹0), Pro (₹499/mo annual), Max (from ₹999/mo).
// - Free is the current plan for non-subscribers; Pro has a "POPULAR" badge.
// - Each plan lists its features. Pro/Max have "Upgrade" CTAs.
// - Upgrade opens Razorpay checkout (payment integration).
// - Current plan shows "Current Plan" CTA (disabled/no action).
//
// ── Test data strategy ──────────────────────────────────────────────────
// student-a is the shared, explicitly read-only account (mutable: false).
// Plan definitions are static fixture data; tests assert against known plans
// and features. Payment flow is mocked to avoid real charges.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'student-a';

async function openSubscription(page) {
  await page.goto('/subscription');
  await expect(page.getByText('Subscription', { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Student Subscription - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and plan cards', async ({ page }) => {
    await openSubscription(page);

    await expect(page.getByText('Subscription', { exact: true }).first()).toBeVisible();
    // All three plans render.
    await expect(page.getByText('Free', { exact: true })).toBeVisible();
    await expect(page.getByText('Pro', { exact: true })).toBeVisible();
    await expect(page.getByText('Max', { exact: true })).toBeVisible();
  });
});

test.describe('Student Subscription - plan details', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows all three plans with their prices', async ({ page }) => {
    await openSubscription(page);

    // Free plan price.
    await expect(page.getByText('₹0')).toBeVisible();
    // Pro plan price.
    await expect(page.getByText(/₹499/)).toBeVisible();
    // Max plan price.
    await expect(page.getByText(/₹999/)).toBeVisible();
  });

  test('Pro plan has a POPULAR badge', async ({ page }) => {
    await openSubscription(page);

    await expect(page.getByText('POPULAR', { exact: true })).toBeVisible();
  });

  test('each plan shows its feature list', async ({ page }) => {
    await openSubscription(page);

    // Free plan features.
    await expect(page.getByText('Personalised Learning Paths')).toBeVisible();
    await expect(page.getByText(/AI Coach/)).toBeVisible();
    // Pro plan features.
    await expect(page.getByText('Unlimited AI Coach messages')).toBeVisible();
    await expect(page.getByText(/Bedtime Stories/)).toBeVisible();
  });
});

test.describe('Student Subscription - CTAs', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('Free plan shows "Current Plan" CTA', async ({ page }) => {
    await openSubscription(page);

    await expect(page.getByText('Current Plan', { exact: true })).toBeVisible();
  });

  test('Pro plan shows "Upgrade to Pro" CTA', async ({ page }) => {
    await openSubscription(page);

    await expect(page.getByText('Upgrade to Pro', { exact: true })).toBeVisible();
  });
});
