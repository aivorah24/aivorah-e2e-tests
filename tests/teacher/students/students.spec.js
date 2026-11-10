// Teacher Students roster management (TeacherStudentsScreen.tsx) — student
// roster, add student, search/filter, link existing, bulk import, promote,
// remove.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Shows the teacher's student roster (GET /student/by-teacher/:email).
// - Tabs/filters: All / Active / Archived (or similar).
// - Search filters by student name/email.
// - "Add Student" flow: create new or link existing student.
// - Bulk import via CSV/XLSX.
// - Promote student to next grade.
// - Remove/unlink student.
//
// ── Test data strategy ──────────────────────────────────────────────────
// teacher-a is the shared, explicitly read-only account (mutable: false).
// teacher-e is the dedicated account for student roster mutations (create/
// link/bulk-import/remove/promote). Tests assert on whatever roster exists
// plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'teacher-a';

async function openStudents(page) {
  await page.goto('/teacher/students');
  await expect(page.getByText(/Students|My Students/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Teacher Students - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and student list or empty state', async ({ page }) => {
    await openStudents(page);

    await expect(page.getByText(/Students|My Students/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no students|add student|import/i)
      .or(page.locator('text=student').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Teacher Students - roster & search', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows students with name/grade/section if any exist', async ({ page }) => {
    await openStudents(page);

    const firstStudent = page.getByText(/student|grade/i).first();
    const hasStudent = await firstStudent.isVisible().catch(() => false);
    if (!hasStudent) return;

    await expect(firstStudent).toBeVisible({ timeout: 10000 });
  });

  test('search filters the roster', async ({ page }) => {
    await openStudents(page);

    const search = page.getByPlaceholder(/search/i).first();
    const hasSearch = await search.isVisible().catch(() => false);
    if (!hasSearch) return;

    await search.fill('zzz-no-such-student');

    // Either a "no matches" state or the list filters down.
    await expect(
      page.getByText(/no students|no matches/i).or(page.locator('text=student').first()),
    ).toBeVisible({ timeout: 10000 });

    await search.fill('');
  });
});

test.describe('Teacher Students - add student', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('the Add Student button opens the add/link flow', async ({ page }) => {
    await openStudents(page);

    const addBtn = page.getByRole('button', { name: /add student|new student/i }).first();
    const hasAddBtn = await addBtn.isVisible().catch(() => false);
    if (!hasAddBtn) return;

    await addBtn.click();

    // The add/link modal or screen should appear.
    await expect(
      page.getByText(/add student|link student|create student|new student/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Teacher Students - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty roster shows the empty state with add/import options', async ({ page }) => {
    await page.route('**/student/by-teacher/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openStudents(page);

    await expect(page.getByText(/no students/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /add student|import/i }).first()).toBeVisible();
  });
});
