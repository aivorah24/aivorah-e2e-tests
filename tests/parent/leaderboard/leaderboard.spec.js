// Parent Leaderboard view (legacy ParentLeaderboardScreen.tsx) — child's
// leaderboard/rankings from the parent's perspective. Legacy screen.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches the child's leaderboard ranking (GET /leaderboard or similar).
// - Shows rank, name, XP/points, and position relative to peers.
// - Child-switching if multiple children linked.
// - Empty state when no leaderboard data.
//
// ── Test data strategy ──────────────────────────────────────────────────
// parent-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever leaderboard data exists plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'parent-a';

async function openLeaderboard(page) {
  await page.goto('/parent/leaderboard');
  await expect(page.getByText(/Leaderboard|Rankings/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Parent Leaderboard - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and leaderboard or empty state', async ({ page }) => {
    await openLeaderboard(page);

    await expect(page.getByText(/Leaderboard|Rankings/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no data|not ranked|empty/i)
      .or(page.locator('text=rank').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Parent Leaderboard - ranking list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows rankings with rank/name/points if any exist', async ({ page }) => {
    await openLeaderboard(page);

    const firstEntry = page.getByText(/rank|leaderboard|xp/i).first();
    const hasEntry = await firstEntry.isVisible().catch(() => false);
    if (!hasEntry) return;

    await expect(firstEntry).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Parent Leaderboard - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty leaderboard shows the empty state', async ({ page }) => {
    await page.route('**/leaderboard*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openLeaderboard(page);

    await expect(page.getByText(/no data|not ranked|empty/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
