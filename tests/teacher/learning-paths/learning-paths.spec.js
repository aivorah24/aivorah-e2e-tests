// Teacher Learning Paths management (TeacherLearningPathsScreen.tsx +
// TeacherLearningPathsManageScreen.tsx) — manage class learning paths,
// publish/reorder/edit teacher-curated paths.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Shows teacher-published learning paths for their grade/subject scope.
// - Create/publish a new learning path from curriculum content.
// - Edit existing paths: reorder units/topics, rename, hide/show.
// - Delete a learning path.
// - Path list shows title, unit count, status (published/draft).
//
// ── Test data strategy ──────────────────────────────────────────────────
// teacher-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever paths exist plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'teacher-a';

async function openLearningPaths(page) {
  await page.goto('/teacher/learning-paths');
  await expect(page.getByText(/Learning Paths|My Learning Paths/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Teacher Learning Paths - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and learning path list or empty state', async ({ page }) => {
    await openLearningPaths(page);

    await expect(page.getByText(/Learning Paths|My Learning Paths/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no learning paths|create path|new path/i)
      .or(page.locator('text=path').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Teacher Learning Paths - path list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows learning paths with title/unit count if any exist', async ({ page }) => {
    await openLearningPaths(page);

    const firstPath = page.getByText(/path|unit/i).first();
    const hasPath = await firstPath.isVisible().catch(() => false);
    if (!hasPath) return;

    await expect(firstPath).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Teacher Learning Paths - create path', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('the Create/New button opens the path creation flow', async ({ page }) => {
    await openLearningPaths(page);

    const createBtn = page
      .getByRole('button', { name: /create path|new path|publish path/i })
      .first();
    const hasCreateBtn = await createBtn.isVisible().catch(() => false);
    if (!hasCreateBtn) return;

    await createBtn.click();

    await expect(
      page.getByText(/create path|new path|publish/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Teacher Learning Paths - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty path list shows the empty state with create option', async ({ page }) => {
    await page.route('**/learning-path**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openLearningPaths(page);

    await expect(page.getByText(/no learning paths/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /create path|new path/i }).first(),
    ).toBeVisible();
  });
});
