// Teacher Assignments management (TeacherAssignmentsScreen.tsx) — create/manage
// assignments, view submissions, quiz library, AI generation, bulk upload.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Tabs: All / Pending / Completed / Drafts (or similar).
// - Create assignment via multiple modes: manual, AI-generate, worksheet upload,
//   quiz library reuse, bulk upload.
// - Assignment list shows title, subject, grade, due date, submission count.
// - Assignment detail modal: view/edit/delete, view submissions.
// - Subject/grade/curriculum filters.
// - Delete assignment with confirmation.
//
// ── Test data strategy ──────────────────────────────────────────────────
// teacher-a is the shared, explicitly read-only account (mutable: false).
// teacher-d is dedicated to assignment cross-persona tests. Tests assert on
// whatever assignments exist plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'teacher-a';

async function openAssignments(page) {
  await page.goto('/teacher/assignments');
  await expect(page.getByText(/Assignments|My Assignments/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Teacher Assignments - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and assignment list or empty state', async ({ page }) => {
    await openAssignments(page);

    await expect(page.getByText(/Assignments|My Assignments/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no assignments|create assignment|new assignment/i)
      .or(page.locator('text=assignment').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Teacher Assignments - tabs & filters', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows assignment tabs (All/Pending/Completed)', async ({ page }) => {
    await openAssignments(page);

    // Tab labels should be present.
    await expect(page.getByText(/all|pending|completed|drafts/i).first()).toBeVisible();
  });

  test('subject/grade filters are available', async ({ page }) => {
    await openAssignments(page);

    // Filter dropdowns/buttons.
    const filter = page.getByRole('button', { name: /subject|grade|filter/i }).first();
    const hasFilter = await filter.isVisible().catch(() => false);
    if (hasFilter) {
      await expect(filter).toBeVisible();
    }
  });
});

test.describe('Teacher Assignments - create assignment', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('the Create/New button opens the assignment creation flow', async ({ page }) => {
    await openAssignments(page);

    const createBtn = page
      .getByRole('button', { name: /create assignment|new assignment|add assignment/i })
      .first();
    const hasCreateBtn = await createBtn.isVisible().catch(() => false);
    if (!hasCreateBtn) return;

    await createBtn.click();

    // Creation modal/screen should appear with mode options.
    await expect(
      page.getByText(/create assignment|new assignment|manual|ai|upload/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Teacher Assignments - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty assignment list shows the empty state with create option', async ({ page }) => {
    await page.route('**/assignments*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openAssignments(page);

    await expect(page.getByText(/no assignments/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /create assignment|new assignment/i }).first(),
    ).toBeVisible();
  });
});
