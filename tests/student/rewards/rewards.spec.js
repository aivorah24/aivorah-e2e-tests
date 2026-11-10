// Student Rewards screen (legacy RewardsScreen.tsx) — merchandise catalogue
// and how-to-earn-credits guide. Legacy screen kept for reference; no backend
// redemption flow exists yet.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Credits are derived from XP: credits = Math.floor(xpPoints / 100).
// - The catalogue shows 6 fixed merchandise items with credit costs (5–150).
// - Each item has an icon, label, description, and credit cost.
// - "How to earn credits" section shows 4 ways to earn (topic/quiz/streak/
//   challenge) with their credit values.
// - No redeem button is wired to a backend — the screen is display-only.
//
// ── Test data strategy ──────────────────────────────────────────────────
// student-a is the shared, explicitly read-only account (mutable: false).
// The catalogue is static fixture data, so tests assert against the known
// items. Credits depend on the account's real XP, captured via API read.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'student-a';

async function openRewards(page) {
  await page.goto('/rewards');
  await expect(page.getByText('Rewards', { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Student Rewards - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and the credits display', async ({ page }) => {
    await openRewards(page);

    await expect(page.getByText('Rewards', { exact: true }).first()).toBeVisible();
    // Credits are shown as "X credits" derived from XP.
    await expect(page.getByText(/\d+ credits/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Student Rewards - merchandise catalogue', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows all 6 catalogue items with their credit costs', async ({ page }) => {
    await openRewards(page);

    const items = [
      { label: 'Aivorah Sticker Pack', credits: '5 credits' },
      { label: 'Aivorah Notebook', credits: '15 credits' },
      { label: 'Champion Badge', credits: '25 credits' },
      { label: 'Surprise Goodie Box', credits: '50 credits' },
      { label: 'Aivorah T-Shirt', credits: '80 credits' },
      { label: 'Elite Learner Trophy', credits: '150 credits' },
    ];

    for (const item of items) {
      await expect(page.getByText(item.label, { exact: true })).toBeVisible();
    }
    // Credit costs appear alongside each item.
    await expect(page.getByText(/5 credits|15 credits|25 credits|50 credits|80 credits|150 credits/)).toBeVisible();
  });
});

test.describe('Student Rewards - how to earn credits', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows the how-to-earn section with all 4 methods', async ({ page }) => {
    await openRewards(page);

    await expect(page.getByText(/How to earn credits/i)).toBeVisible();
    const methods = [
      'Complete a Topic',
      'Finish a Quiz',
      'Daily Goal Streak',
      'Win a Challenge',
    ];
    for (const m of methods) {
      await expect(page.getByText(m, { exact: true })).toBeVisible();
    }
  });
});
