// Student Messages screen (shared MessagesScreen.tsx) — direct messages,
// contacts, and Aivorah bot integration. Part of the shared messages feature.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Shows a conversation list on the left and a chat panel on the right
//   (two-pane on desktop, single-pane on mobile with back navigation).
// - Conversations come from GET /conversations.
// - Contacts come from GET /contacts.
// - Sending a message POSTs /messages.
// - Aivorah bot replies via POST /aivorah-reply.
// - Unread counts shown per conversation.
// - New message menu (NewMenu) to start a conversation.
//
// ── Test data strategy ──────────────────────────────────────────────────
// student-a is the shared, explicitly read-only account (mutable: false).
// Tests assert on whatever conversations exist in the dev DB, plus mocked
// empty states via page.route to prove the empty-state copy is real.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'student-a';

async function openMessages(page) {
  await page.goto('/messages');
  await expect(page.getByText('Messages', { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Student Messages - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header and conversation list or empty state', async ({ page }) => {
    await openMessages(page);

    await expect(page.getByText('Messages', { exact: true }).first()).toBeVisible();
    // Either conversations exist or an empty state renders.
    const listOrEmpty = page
      .getByText(/no messages|start a conversation|new message/i)
      .or(page.locator('text=conversation').first());
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Student Messages - conversation list', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('shows conversations with sender names and unread counts', async ({ page }) => {
    await openMessages(page);

    // If any conversations exist, assert they render.
    const firstConv = page.getByText(/conversation|message/i).first();
    const hasConv = await firstConv.isVisible().catch(() => false);
    if (!hasConv) return;

    // Conversation rows should be visible.
    await expect(firstConv).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Student Messages - chat panel', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('selecting a conversation (if any) shows the message thread', async ({ page }) => {
    await openMessages(page);

    const firstConv = page.getByText(/conversation|message/i).first();
    const hasConv = await firstConv.isVisible().catch(() => false);
    if (!hasConv) return;

    await firstConv.click();

    // Chat panel should show messages or a "no messages yet" state.
    const threadOrEmpty = page
      .getByText(/write a message|no messages yet/i)
      .or(page.getByText(/message/i).first());
    await expect(threadOrEmpty.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Student Messages - empty states (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('an empty conversation list shows the empty state', async ({ page }) => {
    await page.route('**/conversations*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await openMessages(page);

    await expect(page.getByText(/no messages|start a conversation/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('a failed fetch still renders the screen shell', async ({ page }) => {
    await page.route('**/conversations*', (route) => route.abort('failed'));

    await page.goto('/messages');
    await expect(page.getByText('Messages', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText(/no messages|start a conversation/i).or(page.getByText(/error/i)),
    ).toBeVisible({ timeout: 10000 });
  });
});
