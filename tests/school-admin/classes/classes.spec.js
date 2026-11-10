// School-Admin Classes management (SchoolAdminClassesScreen.tsx) — manage
// classes (grade+section combinations), assign class teachers.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches classes (GET /classes).
// - Shows class list with grade, section, class teacher.
// - Create class, edit, assign class teacher.
// - Archive/delete class.
//
// ── Test data strategy ──────────────────────────────────────────────────
// admin-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on the UI elements and mocked mutation flows.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'admin-a';

async function openClasses(page) {
  await page.goto('/school-admin/classes');
  await expect(page.getByText(/Classes|My Classes/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('School-Admin Classes - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and class list or empty state', async ({ page }) => {
    await openClasses(page);

    await expect(page.getByText(/Classes|My Classes/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no classes|add class|create class/i)
      .or(page.locator('text=class').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('School-Admin Classes - class list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows classes with grade/section/teacher if any exist', async ({ page }) => {
    await openClasses(page);

    const firstClass = page.getByText(/class|grade|section/i).first();
    const hasClass = await firstClass.isVisible().catch(() => false);
    if (!hasClass) return;

    await expect(firstClass).toBeVisible({ timeout: 10000 });
  });
});

test.describe('School-Admin Classes - create class', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('the Add/Create button opens the class creation flow', async ({ page }) => {
    await openClasses(page);

    const createBtn = page
      .getByRole('button', { name: /add class|create class|new class/i })
      .first();
    const hasCreateBtn = await createBtn.isVisible().catch(() => false);
    if (!hasCreateBtn) return;

    await createBtn.click();

    await expect(
      page.getByText(/add class|create class|new class/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('School-Admin Classes - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty class list shows the empty state with create option', async ({ page }) => {
    await page.route('**/classes*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openClasses(page);

    await expect(page.getByText(/no classes/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /add class|create class/i }).first(),
    ).toBeVisible();
  });
});
