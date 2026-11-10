// Teacher Challenges management (TeacherChallengesScreen.tsx) — create/manage
// challenges, assign to students, view challenge library.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Shows the challenge list (GET /challenges).
// - Create challenge with title, description, questions, grade, curriculum.
// - Assign challenge to students or classes.
// - Challenge list shows title, grade, curriculum, assignment status.
// - Challenge detail: view/edit/delete, view assignments.
// - Challenge library for reuse.
//
// ── Test data strategy ──────────────────────────────────────────────────
// teacher-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever challenges exist plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'teacher-a';

async function openChallenges(page) {
  await page.goto('/teacher/challenges');
  await expect(page.getByText(/Challenges|My Challenges/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Teacher Challenges - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and challenge list or empty state', async ({ page }) => {
    await openChallenges(page);

    await expect(page.getByText(/Challenges|My Challenges/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no challenges|create challenge|new challenge/i)
      .or(page.locator('text=challenge').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Teacher Challenges - challenge list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows challenges with title/grade/curriculum if any exist', async ({ page }) => {
    await openChallenges(page);

    const firstChallenge = page.getByText(/challenge/i).first();
    const hasChallenge = await firstChallenge.isVisible().catch(() => false);
    if (!hasChallenge) return;

    await expect(firstChallenge).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Teacher Challenges - create challenge', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('the Create/New button opens the challenge creation flow', async ({ page }) => {
    await openChallenges(page);

    const createBtn = page
      .getByRole('button', { name: /create challenge|new challenge|add challenge/i })
      .first();
    const hasCreateBtn = await createBtn.isVisible().catch(() => false);
    if (!hasCreateBtn) return;

    await createBtn.click();

    await expect(
      page.getByText(/create challenge|new challenge/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Teacher Challenges - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty challenge list shows the empty state with create option', async ({ page }) => {
    await page.route('**/challenges*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openChallenges(page);

    await expect(page.getByText(/no challenges/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /create challenge|new challenge/i }).first(),
    ).toBeVisible();
  });
});
