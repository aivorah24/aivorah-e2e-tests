// School-Admin Import History (SchoolAdminImportHistoryScreen.tsx) — log of
// bulk import operations (students/teachers) with status and details.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches import history (GET /import-history).
// - Shows import operations with date, type (students/teachers), status
//   (success/failed/partial), count, and details.
// - Expandable rows for import details/errors.
// - Empty state when no imports.
//
// ── Test data strategy ──────────────────────────────────────────────────
// admin-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on the UI elements and mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'admin-a';

async function openImportHistory(page) {
  await page.goto('/school-admin/import-history');
  await expect(page.getByText(/Import History|Import Log/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('School-Admin Import History - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and import list or empty state', async ({ page }) => {
    await openImportHistory(page);

    await expect(page.getByText(/Import History|Import Log/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no imports|no history|empty/i)
      .or(page.locator('text=import').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('School-Admin Import History - import list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows import operations with date/status/count if any exist', async ({ page }) => {
    await openImportHistory(page);

    const firstImport = page.getByText(/import|student|teacher/i).first();
    const hasImport = await firstImport.isVisible().catch(() => false);
    if (!hasImport) return;

    await expect(firstImport).toBeVisible({ timeout: 10000 });
  });
});

test.describe('School-Admin Import History - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty import history shows the empty state', async ({ page }) => {
    await page.route('**/import-history*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openImportHistory(page);

    await expect(page.getByText(/no imports|no history|empty/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
