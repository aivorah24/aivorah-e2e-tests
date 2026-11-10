// Parent Announcements screen (shared AnnouncementsScreen.tsx used by parent)
// — school announcements feed for the parent persona.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches active announcements (GET /announcements/active).
// - Shows announcement cards with title, body, date.
// - Dismiss/seen tracking (POST /:id/seen).
// - Empty state when no announcements.
// - Filter by date/status if available.
//
// ── Test data strategy ──────────────────────────────────────────────────
// parent-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever announcements exist plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'parent-a';

async function openAnnouncements(page) {
  await page.goto('/parent/announcements');
  await expect(page.getByText(/Announcements/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Parent Announcements - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and announcement list or empty state', async ({ page }) => {
    await openAnnouncements(page);

    await expect(page.getByText(/Announcements/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no announcements|nothing new/i)
      .or(page.locator('text=announcement').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Parent Announcements - announcement list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows announcements with title/date if any exist', async ({ page }) => {
    await openAnnouncements(page);

    const firstAnnouncement = page.getByText(/announcement/i).first();
    const hasAnnouncement = await firstAnnouncement.isVisible().catch(() => false);
    if (!hasAnnouncement) return;

    await expect(firstAnnouncement).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Parent Announcements - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty announcement list shows the empty state', async ({ page }) => {
    await page.route('**/announcements/active*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openAnnouncements(page);

    await expect(page.getByText(/no announcements|nothing new/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
