// Feature: PARENT HELP CENTER — FAQ search, live chat with the "Aivorah
// 24/7" assistant, and submitting a support ticket. Read-only: none of
// these three actions mutate the parent's own account data, so this spec
// safely shares parent-a (already the read-only convention account used
// across the parent dashboard specs) - no dedicated accounts needed, no
// resetOnboarding-style isolation required.
//
// This is the pre-refactor E2E baseline (PH1-PH3) for the legacy
// ParentHelpScreen (src/.legacy-screens/parent/ParentHelpScreen.tsx) -
// written BEFORE moving it into src/screens/parent/help-center/, so a
// rerun after the refactor proves no behavior change, same process as the
// Parent Onboarding FB1-FB6 baseline.

import { test, expect } from '@playwright/test';
import { newPageAs } from '../../helpers/session.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

async function openHelpCenter(browser) {
  const page = await newPageAs(browser, 'parent-a');
  await page.goto('/');
  await page.getByText('Aivorah', { exact: true }).first().waitFor({ timeout: 30000 });
  await dismissAnnouncementIfPresent(page);
  // Two sidebar components render simultaneously on wide viewports: the
  // closed react-navigation Drawer (off-screen, label "Help Centre") and
  // ScreenLayout's own permanent Sidebar (visible, label "Help") - this is
  // the one a real desktop user sees and clicks.
  await page.getByText('Help', { exact: true }).click();
  await expect(page.getByText('How can we help you?', { exact: true })).toBeVisible({ timeout: 15000 });
  return page;
}

test.describe('Parent Help Center', () => {
  // ── PH1: Parent can search FAQs and see a matching result count ────────
  test('parent searches FAQs and sees a filtered result count', async ({ browser }) => {
    const page = await openHelpCenter(browser);
    await page.getByPlaceholder('Search questions...').fill('teacher');
    await expect(page.getByText(/\d+ results?/)).toBeVisible();
    await expect(page.getByText('How do I message my child\'s teacher?', { exact: true })).toBeVisible();
  });

  // ── PH2: Parent can chat with Aivorah 24/7 and get a reply ──────────────
  test('parent chats with Aivorah 24/7 and receives a reply', async ({ browser }) => {
    const page = await openHelpCenter(browser);
    await page.getByText('Aivorah 24/7', { exact: true }).click();
    await expect(page.getByText('Support Assistant · Online', { exact: true })).toBeVisible();

    const input = page.getByPlaceholder("Ask about your child's learning...");
    const question = 'How do I check my child\'s progress?';
    await input.fill(question);
    await input.press('Enter');

    // The parent's own message appears immediately (confirms send worked)...
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    const textRightAfterSend = await page.locator('body').innerText();

    // ...then a reply bubble is appended once the real backend responds -
    // not asserting exact reply content since it's LLM-generated, just
    // that the page's chat text actually grew (a real reply landed),
    // rather than staying frozen at "question sent, nothing back yet".
    await expect(async () => {
      const current = await page.locator('body').innerText();
      expect(current.length).toBeGreaterThan(textRightAfterSend.length);
    }).toPass({ timeout: 20000 });
  });

  // ── PH3: Parent can submit a support ticket and see confirmation ───────
  test('parent submits a support ticket and sees confirmation', async ({ browser }) => {
    const page = await openHelpCenter(browser);
    await page.getByText('Submit Ticket', { exact: true }).click();
    await expect(page.getByText('Submit Support Ticket', { exact: true })).toBeVisible();

    await page.getByPlaceholder('Brief summary of your issue').fill(`E2E PH3 test ticket ${Date.now()}`);
    await page.getByPlaceholder('Please provide as much detail as possible...').fill('This is an automated E2E test ticket, safe to ignore.');

    // The success confirmation is Alert.alert(), which react-native-web does
    // NOT implement (a real, separate gap - real parents on web never see
    // this confirmation either, confirmed by no dialog/DOM change on
    // success). Verifying via the actual network response instead of the
    // non-functional UI confirmation.
    const responsePromise = page.waitForResponse((r) => r.url().includes('/help/ticket'), { timeout: 15000 });
    await page.getByText('Submit Ticket', { exact: true }).last().click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
