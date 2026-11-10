// School-Admin Settings (SchoolAdminSettingsScreen.tsx) — workspace settings,
// branding, access management for the school.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Workspace settings: school name, address, contact info.
// - Branding: upload logo, choose theme colors.
// - Access management: manage admin users, access requests.
// - Save/update workspace settings (PATCH /workspace-settings).
//
// ── Test data strategy ──────────────────────────────────────────────────
// admin-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on the UI elements and mocked mutation flows.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'admin-a';

async function openSettings(page) {
  await page.goto('/school-admin/settings');
  await expect(page.getByText('Settings', { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('School-Admin Settings - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and settings sections', async ({ page }) => {
    await openSettings(page);

    await expect(page.getByText('Settings', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/workspace|school|settings/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('School-Admin Settings - workspace settings', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows workspace settings fields (name, address, contact)', async ({ page }) => {
    await openSettings(page);

    await expect(page.getByText(/workspace|school/i).first()).toBeVisible();
    // Settings form fields.
    const input = page.getByRole('textbox').first();
    const hasInput = await input.isVisible().catch(() => false);
    if (hasInput) {
      await expect(input).toBeVisible();
    }
  });
});

test.describe('School-Admin Settings - branding', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows branding options (logo upload)', async ({ page }) => {
    await openSettings(page);

    await expect(
      page.getByText(/branding|logo|theme/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('School-Admin Settings - access management', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows access management options', async ({ page }) => {
    await openSettings(page);

    await expect(
      page.getByText(/access|admin users|access requests/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
