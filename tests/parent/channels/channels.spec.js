// Parent Channels screen (ChannelsScreen.tsx) — group/class chat rooms.
// Behavioral audit for the parent persona: page load, tabs, search, channel
// selection, message thread view, broadcast (staff-only) read-only composer,
// and members modal.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Parents see the channel list but NEVER the "New channel" (+) button:
//   canManage is true only for teacher/school_admin/super_admin roles
//   (ChannelsScreen.tsx line 57). Parents can read and post in member
//   channels but cannot create channels.
// - Broadcast channels (posting === 'staff_only') show a read-only notice
//   instead of the composer: "Only admins and teachers can send messages in
//   this channel".
// - Member channels show the composer ("Write a message…") for parents.
// - Tabs filter the list: Unread/Staff/Public. Search filters by name.
// - Members modal shows the roster with a search box.
//
// ── Test data strategy ──────────────────────────────────────────────────
// parent-a is the shared, explicitly read-only account (mutable: false).
// Channels are read-only for parents on this screen (they cannot create a
// channel from here), so no account isolation is needed. Tests assert on
// whatever channels exist in the dev DB for this account, plus mocked-empty
// states via page.route to prove the empty-state copy is real.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'parent-a';

async function openChannels(page) {
  await page.goto('/channels');
  await expect(page.getByText('Channels', { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Parent Channels - page load & navigation', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header, search box, and the four tabs', async ({ page }) => {
    await openChannels(page);

    await expect(page.getByText('Class & school group chats', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Search for a chat or channel')).toBeVisible();

    const tabs = ['All', 'Unread', 'Staff', 'Public channels'];
    for (const label of tabs) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('parents do NOT see the New channel (+) button (canManage is role-gated)', async ({
    page,
  }) => {
    await openChannels(page);

    // The + button only renders when canManage is true (teacher/admin/super-
    // admin). A parent must never see it.
    await expect(page.getByRole('button', { name: /new|create channel/i })).toHaveCount(0);
  });
});

test.describe('Parent Channels - tabs & search', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('switching tabs updates the active tab styling', async ({ page }) => {
    await openChannels(page);

    await expect(page.getByText('All', { exact: true })).toHaveClass(/active/i);

    for (const label of ['Unread', 'Staff', 'Public channels']) {
      await page.getByText(label, { exact: true }).click();
      await expect(page.getByText(label, { exact: true })).toHaveClass(/active/i);
    }
  });

  test('a nonsense search query shows the "Nothing matches" empty state', async ({ page }) => {
    await openChannels(page);

    const search = page.getByPlaceholder('Search for a chat or channel');
    await search.fill('zzz-no-such-channel-xyz');

    await expect(page.getByText(/Nothing matches/)).toBeVisible({ timeout: 5000 });

    await search.fill('');
    await expect(page.getByText(/Nothing matches/)).toHaveCount(0);
  });
});

test.describe('Parent Channels - channel selection & composer', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('selecting a channel (if any exist) shows its message thread or welcome state', async ({
    page,
  }) => {
    await openChannels(page);

    const firstRow = page.getByText(/members/).first();
    const hasChannels = await firstRow.isVisible().catch(() => false);

    if (hasChannels) {
      await firstRow.click();

      const threadOrWelcome = page
        .getByText('Write a message…')
        .or(page.getByText('This is the beginning of'))
        .or(page.getByText(/Only admins and teachers can send/));
      await expect(threadOrWelcome.first()).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText('Select a channel to view messages')).toBeVisible();
    }
  });

  test('opening a broadcast channel shows the read-only notice instead of a composer', async ({
    page,
  }) => {
    await openChannels(page);

    // Find a broadcast channel row (contains "broadcast" in its subtitle).
    const broadcastRow = page.getByText(/broadcast/).first();
    const hasBroadcast = await broadcastRow.isVisible().catch(() => false);

    if (hasBroadcast) {
      await broadcastRow.click();

      // Broadcast channels are staff-only posting — parents see a lock notice.
      await expect(
        page.getByText(/Only admins and teachers can send messages in this channel/),
      ).toBeVisible({ timeout: 10000 });
      // The composer input must NOT be present.
      await expect(page.getByPlaceholder('Write a message…')).toHaveCount(0);
    }
    // If no broadcast channel is seeded, this test is a no-op (skip) — the
    // behavior is still covered by the mocked test below.
  });

  test('a mocked broadcast channel always shows the read-only notice for a parent', async ({
    page,
  }) => {
    // Seed a single staff-only channel for this account.
    await page.route('**/channels?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ch-broadcast-mock',
            name: 'Staff Announcements',
            category: 'staff',
            iconLabel: 'STAF',
            grade: null,
            section: null,
            posting: 'staff_only',
            memberCount: 12,
            unread: 0,
            lastMessage: { body: 'Welcome to the school term.', at: new Date().toISOString() },
            canPost: false,
            postingNote: 'Broadcast',
            isManager: false,
          },
        ]),
      }),
    );
    // Seed the messages for that channel (empty thread).
    await page.route('**/channels/ch-broadcast-mock/messages*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ channel: {}, canPost: false, messages: [] }),
      }),
    );

    await openChannels(page);

    // Select the broadcast channel.
    await page.getByText('Staff Announcements').click();

    // Read-only notice must show; composer must NOT.
    await expect(
      page.getByText(/Only admins and teachers can send messages in this channel/),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Write a message…')).toHaveCount(0);
  });
});

test.describe('Parent Channels - members modal', () => {
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

    const membersBtn = page.locator('text=/members/i').first();
    await membersBtn.click();

    await expect(page.getByText(/Members \(\d+\)/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Search…')).toBeVisible();
  });
});

test.describe('Parent Channels - empty states (mocked)', () => {
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

    await expect(page.getByText('No channels yet.')).toBeVisible({ timeout: 10000 });
  });

  test('a network-level failure on /channels still renders the screen shell', async ({
    page,
  }) => {
    await page.route('**/channels?*', (route) => route.abort('failed'));

    await page.goto('/channels');
    await expect(page.getByText('Channels', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText('No channels yet.').or(page.getByText(/Nothing matches/)),
    ).toBeVisible({ timeout: 10000 });
  });
});
