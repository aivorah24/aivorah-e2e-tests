// School-Admin Promotions (SchoolAdminPromotionsScreen.tsx) — grade promotion
// workflow. NOTE: This is a "Coming Soon" placeholder screen — not yet built.
// The test verifies the placeholder state rather than a real feature.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - The screen is a placeholder with "Coming Soon" copy.
// - No real promotion functionality exists yet.
// - May show a notice that the feature is under development.
//
// ── Test data strategy ──────────────────────────────────────────────────
// admin-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on the placeholder UI.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'admin-a';

async function openPromotions(page) {
  await page.goto('/school-admin/promotions');
  await expect(
    page.getByText(/Promotions|Promote|Coming Soon/i).first(),
  ).toBeVisible({ timeout: 15000 });
  await dismissAnnouncementIfPresent(page);
}

test.describe('School-Admin Promotions - placeholder state', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header', async ({ page }) => {
    await openPromotions(page);

    await expect(page.getByText(/Promotions/i).first()).toBeVisible();
  });

  test('shows the "Coming Soon" placeholder copy (feature not yet built)', async ({ page }) => {
    await openPromotions(page);

    // The placeholder screen shows a coming-soon message.
    await expect(
      page.getByText(/coming soon|under development|not available|coming soon/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
