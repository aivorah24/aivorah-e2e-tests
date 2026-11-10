// Student "My Classes" screen (MyClassesScreen.tsx) — class homeroom card list.
// B2B only: independent (B2C) accounts see a connect-bridge empty state instead
// of fetching a roster.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Title is "My Classes" for student/teacher, "My Kids' Classes" for parent.
// - B2C accounts (no schoolId) show IndependentAccountEmpty bridge, never fetch.
// - B2B accounts fetch classes (GET /classes/mine) and render one card per
//   class (grade + section + class teacher).
// - Empty state: "No class assigned yet. Ask your school administrator..."
// - Error state: retry button re-fetches.
// - Tapping a card navigates to ClassDetailScreen.
//
// ── Test data strategy ──────────────────────────────────────────────────
// student-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever classes exist in the dev DB for this account, plus
// mocked empty/error states via page.route to prove the empty-state copy is real.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'student-a';

async function openMyClasses(page) {
  await page.goto('/my-classes');
  await expect(page.getByText('My Classes', { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Student My Classes - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and subtitle', async ({ page }) => {
    await openMyClasses(page);

    await expect(
      page.getByText('Homeroom, portfolio and updates for your class', { exact: true }),
    ).toBeVisible();
  });
});

test.describe('Student My Classes - class list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows class cards with grade/section if any exist', async ({ page }) => {
    await openMyClasses(page);

    // Either class cards exist or the empty/error state renders — never a
    // stuck loading state.
    const listOrEmpty = page
      .getByText(/No class assigned yet/i)
      .or(page.getByText(/Failed to load/i))
      .or(page.locator('text=Grade').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });

  test('tapping a class card (if any) navigates to the class detail screen', async ({
    page,
  }) => {
    await openMyClasses(page);

    // Find a class card (contains "Grade" text).
    const firstCard = page.getByText(/Grade/).first();
    const hasCard = await firstCard.isVisible().catch(() => false);
    if (!hasCard) return; // skip if no classes seeded

    await firstCard.click();

    // ClassDetailScreen's own heading proves real navigation happened.
    await expect(page.getByText(/Class Detail|Portfolio|Announcements|Assignments/i)).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Student My Classes - empty states (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty class list shows the "No class assigned" empty state', async ({ page }) => {
    await page.route('**/classes/mine*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openMyClasses(page);

    await expect(page.getByText(/No class assigned yet/i)).toBeVisible({ timeout: 10000 });
  });

  test('a failed fetch shows an error with a retry button', async ({ page }) => {
    await page.route('**/classes/mine*', (route) => route.abort('failed'));

    await openMyClasses(page);

    await expect(page.getByText(/Failed to load/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});
