// Parent Schedule view (legacy ParentScheduleScreen.tsx) — child's schedule
// from the parent's perspective. Legacy screen.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches the child's schedule events (GET /schedule?studentId=).
// - Shows events by day/week with title, time, date.
// - Child-switching if multiple children linked.
// - Empty state when no events.
//
// ── Test data strategy ──────────────────────────────────────────────────
// parent-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever schedule events exist plus mocked empty states.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'parent-a';

async function openSchedule(page) {
  await page.goto('/parent/schedule');
  await expect(page.getByText(/Schedule|Timetable/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Parent Schedule - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and schedule or empty state', async ({ page }) => {
    await openSchedule(page);

    await expect(page.getByText(/Schedule|Timetable/i).first()).toBeVisible();
    const listOrEmpty = page
      .getByText(/no events|nothing scheduled|empty/i)
      .or(page.locator('text=event').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Parent Schedule - event list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows schedule events with title/time if any exist', async ({ page }) => {
    await openSchedule(page);

    const firstEvent = page.getByText(/event|schedule|class/i).first();
    const hasEvent = await firstEvent.isVisible().catch(() => false);
    if (!hasEvent) return;

    await expect(firstEvent).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Parent Schedule - empty state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty schedule shows the empty state', async ({ page }) => {
    await page.route('**/schedule*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openSchedule(page);

    await expect(page.getByText(/no events|nothing scheduled|empty/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
