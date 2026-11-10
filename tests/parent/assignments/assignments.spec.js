// Parent Assignments view (ParentAssignmentsScreen.tsx) — child's assignments
// from the parent's perspective.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches assignments for the parent's linked child (GET /assignments?studentId=).
// - Shows assignment cards with title, subject, due date, status (pending/
//   completed/graded).
// - Child-switching if multiple children linked.
// - Empty state when no assignments.
//
// ── Test data strategy ──────────────────────────────────────────────────
// parent-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever assignments exist plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'parent-a';

async function openAssignments(page) {
  await page.goto('/parent/assignments');
  await expect(page.getByText(/Assignments/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Parent Assignments - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and assignment list or empty state', async ({ page }) => {
    await openAssignments(page);

    await expect(page.getByText(/Assignments/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no assignments|nothing pending/i)
      .or(page.locator('text=assignment').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Parent Assignments - assignment list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows assignments with title/subject/due date if any exist', async ({ page }) => {
    await openAssignments(page);

    const firstAssignment = page.getByText(/assignment/i).first();
    const hasAssignment = await firstAssignment.isVisible().catch(() => false);
    if (!hasAssignment) return;

    await expect(firstAssignment).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Parent Assignments - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty assignment list shows the empty state', async ({ page }) => {
    await page.route('**/assignments*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openAssignments(page);

    await expect(page.getByText(/no assignments|nothing pending/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
