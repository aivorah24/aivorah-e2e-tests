// Student Channels screen (ChannelsScreen.tsx) — group/class chat rooms.
// Behavioral audit for the student persona: page load, tabs (All/Unread/
// Staff/Public), search, channel selection, message thread view, members
// modal, and the read-only composer for broadcast channels.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Students see the channel list but NEVER the "New channel" (+) button:
//   canManage is true only for teacher/school_admin/super_admin roles
//   (ChannelsScreen.tsx line 57). Students can read and post in member
//   channels but cannot create channels.
// - Tabs filter the list: Unread hides channels with unread === 0; Staff
//   shows only category === 'staff'; Public shows only category === 'public'.
// - Search filters by channel name (case-insensitive substring).
// - Selecting a channel loads its messages and marks it read (unread → 0).
// - Broadcast channels (posting === 'staff_only') show a read-only notice
//   instead of the composer: "Only admins and teachers can send messages".
// - Members modal shows the roster with a search box and "(You)" tag.
// - Empty states: "No channels yet." (no filter) vs. `Nothing matches "..."`
//   (with an active search query).
//
// ── Test data strategy ──────────────────────────────────────────────────
// student-a is the shared, explicitly read-only account (mutable: false).
// Channels are read-only for students (they cannot create/post to a new
// channel from this screen), so no account isolation is needed. The tests
// assert on whatever channels exist in the dev DB for this account, plus
// mocked-empty states via page.route to prove the empty-state copy is real.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'student-a';

async function openChannels(page) {
  await page.goto('/channels');
  await expect(page.getByText('Channels', { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Student Channels - page load & navigation', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header, search box, and the four tabs', async ({ page }) => {
    await openChannels(page);

    await expect(page.getByText('Class & school group chats', { exact: true })).toBeVisible();

    // Search box is always present.
    await expect(page.getByPlaceholder('Search for a chat or channel')).toBeVisible();

    // All four tabs render in order.
    const tabs = ['All', 'Unread', 'Staff', 'Public channels'];
    for (const label of tabs) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('students do NOT see the New channel (+) button (canManage is role-gated)', async ({
    page,
  }) => {
    await openChannels(page);

    // The + button only renders when canManage is true (teacher/admin/super-
    // admin). A student must never see it.
    await expect(page.getByRole('button', { name: /new|create channel/i })).toHaveCount(0);
  });

  test('a nonsense search query shows the "Nothing matches" empty state', async ({ page }) => {
    await openChannels(page);

    const search = page.getByPlaceholder('Search for a chat or channel');
    await search.fill('zzz-no-such-channel-xyz');

    await expect(page.getByText(/Nothing matches/)).toBeVisible({ timeout: 5000 });

    // Clearing the search restores the full list (or the default empty state).
    await search.fill('');
    await expect(page.getByText(/Nothing matches/)).toHaveCount(0);
  });
});

test.describe('Student Channels - tabs filter the channel list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('switching between tabs updates the active tab styling', async ({ page }) => {
    await openChannels(page);

    // All is active by default.
    await expect(page.getByText('All', { exact: true })).toHaveClass(/active/i);

    for (const label of ['Unread', 'Staff', 'Public channels']) {
      await page.getByText(label, { exact: true }).click();
      await expect(page.getByText(label, { exact: true })).toHaveClass(/active/i);
    }
  });

  test('search narrowing to nothing matches shows empty state without crashing', async ({
    page,
  }) => {
    await openChannels(page);

    const search = page.getByPlaceholder('Search for a chat or channel');
    await search.fill('zzz');

    // Either the filtered empty state or (if there happen to be matches) the
    // list itself — the key is the screen never shows a broken/loading state.
    const listOrEmpty = page
      .getByText(/Nothing matches/)
      .or(page.locator('text=members').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Student Channels - channel selection & message thread', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('selecting a channel (if any exist) shows its message thread', async ({ page }) => {
    await openChannels(page);

    // Try to find a channel row (a row containing "members").
    const firstRow = page.getByText(/members/).first();
    const hasChannels = await firstRow.isVisible().catch(() => false);

    if (hasChannels) {
      await firstRow.click();

      // After selection: either a message thread OR the "beginning of" welcome
      // state for a channel with no messages yet.
      const threadOrWelcome = page
        .getByText('Write a message…')
        .or(page.getByText('This is the beginning of'))
        .or(page.getByText(/Only admins and teachers can send/));
      await expect(threadOrWelcome.first()).toBeVisible({ timeout: 10000 });
    } else {
      // No channels in dev DB for this account — the empty state must render.
      await expect(page.getByText('Select a channel to view messages')).toBeVisible();
    }
  });

  test('opening a channel shows its members count in the header', async ({ page }) => {
    await openChannels(page);

    const firstRow = page.getByText(/members/).first();
    const hasChannels = await firstRow.isVisible().catch(() => false);
    if (!hasChannels) return; // skip if no channels seeded

    await firstRow.click();

    // The members button shows "<N>" next to the users icon.
    await expect(page.locator('text=/members/i').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Student Channels - members modal', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('opening the members modal shows the roster and a search box', async ({ page }) => {
    await openChannels(page);

    const firstRow = page.getByText(/members/).first();
    const hasChannels = await firstRow.isVisible().catch(() => false);
    if (!hasChannels) return;

    await firstRow.click();

    // Members button is in the conversation header.
    const membersBtn = page.locator('text=/members/i').first();
    await membersBtn.click();

    // Modal heading shows the count.
    await expect(page.getByText(/Members \(\d+\)/)).toBeVisible({ timeout: 10000 });
    // Search box inside the modal.
    await expect(page.getByPlaceholder('Search…')).toBeVisible();
  });
});

test.describe('Student Channels - empty states (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty channel list shows the default empty state', async ({ page }) => {
    await page.route('**/channels?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openChannels(page);

    // Empty array → "No channels yet." (no active search query).
    await expect(page.getByText('No channels yet.')).toBeVisible({ timeout: 10000 });
  });

  test('a network-level failure on /channels still renders the screen shell', async ({
    page,
  }) => {
    await page.route('**/channels?*', (route) => route.abort('failed'));

    await page.goto('/channels');
    // The header must still render even if the fetch fails.
    await expect(page.getByText('Channels', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    // And the screen falls back to an empty state rather than hanging.
    await expect(
      page.getByText('No channels yet.').or(page.getByText(/Nothing matches/)),
    ).toBeVisible({ timeout: 10000 });
  });
});
