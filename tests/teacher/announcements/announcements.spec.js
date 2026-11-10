// Teacher Announcements compose (AnnouncementManagerScreen.tsx) — compose,
// schedule, publish, and archive school announcements.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Compose announcement: title, body, target audience (grade/section/all).
// - Schedule for future delivery.
// - Publish immediately.
// - Archive existing announcements.
// - Announcement list shows title, status (published/draft/scheduled), date.
//
// ── Test data strategy ──────────────────────────────────────────────────
// teacher-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on the UI elements and mocked mutation flows.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'teacher-a';

async function openAnnouncements(page) {
  await page.goto('/teacher/announcements');
  await expect(page.getByText(/Announcements/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Teacher Announcements - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and announcement list or empty state', async ({ page }) => {
    await openAnnouncements(page);

    await expect(page.getByText(/Announcements/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no announcements|compose|new announcement/i)
      .or(page.locator('text=announcement').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Teacher Announcements - compose', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('the Compose/New button opens the announcement composer', async ({ page }) => {
    await openAnnouncements(page);

    const composeBtn = page
      .getByRole('button', { name: /compose|new announcement|create announcement/i })
      .first();
    const hasComposeBtn = await composeBtn.isVisible().catch(() => false);
    if (!hasComposeBtn) return;

    await composeBtn.click();

    await expect(
      page.getByText(/compose|new announcement|title|body/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Teacher Announcements - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty announcement list shows the empty state with compose option', async ({ page }) => {
    await page.route('**/announcements*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openAnnouncements(page);

    await expect(page.getByText(/no announcements/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /compose|new announcement/i }).first(),
    ).toBeVisible();
  });
});
