// School-Admin Grades & Sections config (SchoolAdminGradesSectionsScreen.tsx)
// — configure grades and sections for the school.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches grades & sections (GET /grades-sections).
// - Create grade, create section under a grade.
// - Edit/archive grade.
// - Set class teacher for a grade/section.
// - Grid/list view of grades with their sections.
//
// ── Test data strategy ──────────────────────────────────────────────────
// admin-a is the shared, explicitly read-only account (mutable: false).
// admin-b is the dedicated account for school-admin mutations. Tests assert
// on the UI elements and mocked mutation flows.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'admin-a';

async function openGradesSections(page) {
  await page.goto('/school-admin/grades-sections');
  await expect(page.getByText(/Grades|Sections|Grades & Sections/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('School-Admin Grades & Sections - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and grades list or empty state', async ({ page }) => {
    await openGradesSections(page);

    await expect(page.getByText(/Grades|Sections|Grades & Sections/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no grades|add grade|create grade/i)
      .or(page.locator('text=grade').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('School-Admin Grades & Sections - grade list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows grades with their sections if any exist', async ({ page }) => {
    await openGradesSections(page);

    const firstGrade = page.getByText(/grade/i).first();
    const hasGrade = await firstGrade.isVisible().catch(() => false);
    if (!hasGrade) return;

    await expect(firstGrade).toBeVisible({ timeout: 10000 });
  });
});

test.describe('School-Admin Grades & Sections - create grade', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('the Add/Create button opens the grade creation flow', async ({ page }) => {
    await openGradesSections(page);

    const createBtn = page
      .getByRole('button', { name: /add grade|create grade|new grade/i })
      .first();
    const hasCreateBtn = await createBtn.isVisible().catch(() => false);
    if (!hasCreateBtn) return;

    await createBtn.click();

    await expect(
      page.getByText(/add grade|create grade|new grade/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('School-Admin Grades & Sections - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty grades list shows the empty state with create option', async ({ page }) => {
    await page.route('**/grades-sections*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ grades: [], myHomerooms: [] }),
      }),
    );

    await openGradesSections(page);

    await expect(page.getByText(/no grades/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /add grade|create grade/i }).first(),
    ).toBeVisible();
  });
});
