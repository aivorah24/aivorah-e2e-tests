// Teacher Help Center screen — search, the "Chat with Aivorah 24/7" AI support
// modal, the "Submit a Ticket" support-ticket modal, Browse Topics (topic
// detail modal + article expand/collapse + "Go to X" navigation), and the FAQ
// accordion. This mirrors the student help-center spec but for the teacher
// persona (teacher-a, shared read-only account).
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Search (HelpCenterScreen.tsx's filteredTopics/filteredFaqs) filters BOTH
//   topics and FAQs from a single input, case-insensitively. The counter text
//   ("N topics · M FAQs") only renders once search.length > 0.
// - The AI chat (useHelpChat.ts) POSTs to /help/chat and renders
//   `data.reply || data.error || 'Something went wrong.'` on success, or a
//   fixed "Could not reach support. Please try again." on a network-level
//   throw.
// - Ticket validation (useSupportTicket.ts's handleSubmitTicket): empty
//   subject or empty message calls Alert.alert(...) and returns before any
//   network call.
// - Ticket success (200 + {success:true}): ticketVisible is set to false and
//   the subject/message fields are cleared BEFORE Alert.alert() runs.
// - Ticket failure (non-200, or {success:false}): the catch block does NOT
//   touch ticketVisible or the field values — the modal stays open.
// - FAQ accordion allows only ONE open FAQ at a time.
// - Topic modal articles come from a static per-topic array; "Go to {label}"
//   navigates via navigation.navigate(topic.screen) then closes the modal.
//
// ── Test data strategy ──────────────────────────────────────────────────
// teacher-a is the shared, explicitly read-only account (mutable: false).
// Nothing in this spec writes to student_stats, habits, challenges, or any
// other feature's data — the chat endpoint is stateless and the ticket
// endpoint only sends an email. Tests use mocked /help/chat and /help/ticket
// responses for validation/loading/error behavior, plus ONE real end-to-end
// ticket submission tagged "[E2E TEST - ignore]".

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';
import {
  searchInput,
  clearSearchButton,
  chatCard,
  ticketCard,
  chatModalHeading,
  closeChatButton,
  chatInput,
  sendChatButton,
  chatSuggestionChip,
  chatBubbleText,
  topicRow,
  topicModalHeading,
  closeTopicModalButton,
  goToTopicButton,
  articleRow,
  noArticlesMessage,
  ticketModalHeading,
  closeTicketModalButton,
  ticketSubjectInput,
  ticketMessageInput,
  cancelTicketButton,
  submitTicketButton,
  faqQuestion,
  faqAnswer,
  noTopicsMessage,
  noFaqsMessage,
  searchCount,
} from '../../helpers/helpCenterLocators.js';

const ACCOUNT = 'teacher-a';

async function openHelpCenter(page) {
  await page.goto('/help-center');
  await expect(page.getByText('How can we', { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await dismissAnnouncementIfPresent(page);
}

async function mockChat(page, body, { status = 200 } = {}) {
  await page.route('**/help/chat', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

async function mockTicket(page, body, { status = 200 } = {}) {
  await page.route('**/help/ticket', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test.describe('Teacher Help Center - page load, search', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads with header, hero, search, support cards, all topics, and all FAQs', async ({ page }) => {
    await openHelpCenter(page);

    await expect(page.getByText('Help Center', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/We're here to support you, .+\./)).toBeVisible();
    await expect(page.getByText('How can we', { exact: false })).toBeVisible();
    await expect(searchInput(page)).toBeVisible();

    await expect(page.getByText('Still need help?', { exact: true })).toBeVisible();
    await expect(chatCard(page)).toBeVisible();
    await expect(ticketCard(page)).toBeVisible();

    await expect(page.getByText('Browse Topics', { exact: true })).toBeVisible();
    for (const label of [
      'Account & Profile', 'XP & Streaks', 'Badges', 'Learning Paths',
      'Billing & Plans', 'Technical Support', 'Assignments', 'AI Coach',
    ]) {
      await expect(topicRow(page, label)).toBeVisible();
    }

    await expect(page.getByText('Frequently Asked Questions', { exact: true })).toBeVisible();
    await expect(faqQuestion(page, 'How do I start a new learning path?')).toBeVisible();
    await expect(faqQuestion(page, 'How do I contact a human support agent?')).toBeVisible();
  });

  test('search filters both Browse Topics and FAQs together, with a live count', async ({ page }) => {
    await openHelpCenter(page);

    await searchInput(page).fill('XP');

    await expect(searchCount(page)).toBeVisible();
    await expect(topicRow(page, 'XP & Streaks')).toBeVisible();
    await expect(topicRow(page, 'Badges')).toBeVisible();
    await expect(topicRow(page, 'Billing & Plans')).toHaveCount(0);
    await expect(topicRow(page, 'Learning Paths')).toHaveCount(0);

    await expect(faqQuestion(page, 'How are XP points and levels calculated?')).toBeVisible();
    await expect(faqQuestion(page, 'Can I change my study schedule?')).toHaveCount(0);
  });

  test('clearing the search restores the full topic and FAQ lists', async ({ page }) => {
    await openHelpCenter(page);

    await searchInput(page).fill('XP');
    await expect(topicRow(page, 'Learning Paths')).toHaveCount(0);

    await clearSearchButton(page).click();

    await expect(searchInput(page)).toHaveValue('');
    await expect(searchCount(page)).toHaveCount(0);
    await expect(topicRow(page, 'Learning Paths')).toBeVisible();
    await expect(faqQuestion(page, 'Can I change my study schedule?')).toBeVisible();
  });

  test('a query matching nothing shows both empty states with the real copy', async ({ page }) => {
    await openHelpCenter(page);

    await searchInput(page).fill('zzz-no-such-topic-or-faq-zzz');

    await expect(noTopicsMessage(page, 'zzz-no-such-topic-or-faq-zzz')).toBeVisible();
    await expect(noFaqsMessage(page, 'zzz-no-such-topic-or-faq-zzz')).toBeVisible();
    await expect(searchCount(page)).toHaveText('0 topics · 0 FAQs');
  });
});

test.describe('Teacher Help Center - Aivorah 24/7 chat (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('opens with the seeded greeting and all 5 quick-suggestion chips', async ({ page }) => {
    await openHelpCenter(page);
    await chatCard(page).click();

    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Your AI support assistant', { exact: true })).toBeVisible();
    await expect(page.getByText(/Hi! I'm your Aivorah 24\/7/)).toBeVisible();
    for (const label of ['About XP', 'About badges', 'Learning paths', 'How XP works?', 'Daily streaks']) {
      await expect(chatSuggestionChip(page, label)).toBeVisible();
    }
    await expect(chatInput(page)).toBeVisible();
  });

  test('clicking a suggestion chip sends its exact label as a user message and renders the mocked reply', async ({ page }) => {
    await mockChat(page, { reply: 'XP is earned by completing lessons, assignments, and challenges.' });
    await openHelpCenter(page);
    await chatCard(page).click();
    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });

    await chatSuggestionChip(page, 'About XP').click();

    await expect(chatBubbleText(page, 'About XP')).toBeVisible();
    await expect(chatBubbleText(page, 'XP is earned by completing lessons, assignments, and challenges.')).toBeVisible();
  });

  test('typing a message and clicking Send posts it and renders the mocked reply', async ({ page }) => {
    await mockChat(page, { reply: 'Streaks reset if you miss a day.' });
    await openHelpCenter(page);
    await chatCard(page).click();
    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });

    await chatInput(page).fill('What happens to my streak if I miss a day?');
    await sendChatButton(page).click();

    await expect(chatBubbleText(page, 'What happens to my streak if I miss a day?')).toBeVisible();
    await expect(chatBubbleText(page, 'Streaks reset if you miss a day.')).toBeVisible();
    await expect(chatInput(page)).toHaveValue('');
  });

  test('Send is disabled with empty input and enabled once text is typed', async ({ page }) => {
    await openHelpCenter(page);
    await chatCard(page).click();
    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });

    await expect(sendChatButton(page)).toBeDisabled();
    await chatInput(page).fill('a');
    await expect(sendChatButton(page)).toBeEnabled();
    await chatInput(page).fill('');
    await expect(sendChatButton(page)).toBeDisabled();
  });

  test('a network-level failure (fetch rejects) shows the fixed "could not reach support" fallback', async ({ page }) => {
    await page.route('**/help/chat', (route) => route.abort());
    await openHelpCenter(page);
    await chatCard(page).click();
    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });

    await chatInput(page).fill('This will fail at the network level');
    await sendChatButton(page).click();

    await expect(chatBubbleText(page, 'Could not reach support. Please try again.')).toBeVisible({ timeout: 10000 });
    await expect(chatInput(page)).toBeEnabled();
  });

  test('a 500 response with an error field renders that error text (not the network fallback)', async ({ page }) => {
    await mockChat(page, { error: 'Support chat unavailable. Please try again.' }, { status: 500 });
    await openHelpCenter(page);
    await chatCard(page).click();
    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });

    await chatInput(page).fill('Trigger a backend error');
    await sendChatButton(page).click();

    await expect(chatBubbleText(page, 'Support chat unavailable. Please try again.')).toBeVisible({ timeout: 10000 });
  });

  test('closing and reopening the chat keeps the conversation history (state lives outside the modal)', async ({ page }) => {
    await mockChat(page, { reply: 'This should still be here after reopening.' });
    await openHelpCenter(page);
    await chatCard(page).click();
    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });

    await chatInput(page).fill('Remember this message');
    await sendChatButton(page).click();
    await expect(chatBubbleText(page, 'Remember this message')).toBeVisible();
    await expect(chatBubbleText(page, 'This should still be here after reopening.')).toBeVisible();

    await closeChatButton(page).click();
    await expect(chatModalHeading(page)).toHaveCount(0);

    await chatCard(page).click();
    await expect(chatModalHeading(page)).toBeVisible({ timeout: 10000 });
    // History persists across close/reopen.
    await expect(chatBubbleText(page, 'Remember this message')).toBeVisible();
    await expect(chatBubbleText(page, 'This should still be here after reopening.')).toBeVisible();
  });
});

test.describe('Teacher Help Center - Submit Support Ticket (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('opens with empty subject/message fields and a disabled Submit button', async ({ page }) => {
    await openHelpCenter(page);
    await ticketCard(page).click();
    await expect(ticketModalHeading(page)).toBeVisible({ timeout: 10000 });

    await expect(ticketSubjectInput(page)).toBeVisible();
    await expect(ticketMessageInput(page)).toBeVisible();
    await expect(ticketSubjectInput(page)).toHaveValue('');
    await expect(ticketMessageInput(page)).toHaveValue('');
    await expect(submitTicketButton(page)).toBeDisabled();
  });

  test('typing both fields enables Submit', async ({ page }) => {
    await openHelpCenter(page);
    await ticketCard(page).click();
    await expect(ticketModalHeading(page)).toBeVisible({ timeout: 10000 });

    await expect(submitTicketButton(page)).toBeDisabled();
    await ticketSubjectInput(page).fill('Subject');
    await expect(submitTicketButton(page)).toBeDisabled();
    await ticketMessageInput(page).fill('Message');
    await expect(submitTicketButton(page)).toBeEnabled();
  });

  test('a successful submission closes the modal and clears the fields', async ({ page }) => {
    await mockTicket(page, { success: true });
    await openHelpCenter(page);
    await ticketCard(page).click();
    await expect(ticketModalHeading(page)).toBeVisible({ timeout: 10000 });

    await ticketSubjectInput(page).fill('Test subject');
    await ticketMessageInput(page).fill('Test message');
    await submitTicketButton(page).click();

    await expect(ticketModalHeading(page)).toHaveCount(0, { timeout: 10000 });
    await expect(ticketSubjectInput(page)).toHaveValue('');
    await expect(ticketMessageInput(page)).toHaveValue('');
  });

  test('a failed submission (success:false) leaves the modal open with the typed fields intact', async ({ page }) => {
    await mockTicket(page, { success: false }, { status: 500 });
    await openHelpCenter(page);
    await ticketCard(page).click();
    await expect(ticketModalHeading(page)).toBeVisible({ timeout: 10000 });

    await ticketSubjectInput(page).fill('Test subject');
    await ticketMessageInput(page).fill('Test message');
    await submitTicketButton(page).click();

    await expect(ticketModalHeading(page)).toBeVisible();
    await expect(ticketSubjectInput(page)).toHaveValue('Test subject');
    await expect(ticketMessageInput(page)).toHaveValue('Test message');
  });

  test('Cancel closes the modal the same way as the Close (X) button', async ({ page }) => {
    await openHelpCenter(page);
    await ticketCard(page).click();
    await expect(ticketModalHeading(page)).toBeVisible({ timeout: 10000 });

    await cancelTicketButton(page).click();
    await expect(ticketModalHeading(page)).toHaveCount(0);

    await ticketCard(page).click();
    await expect(ticketModalHeading(page)).toBeVisible({ timeout: 10000 });
    await closeTicketModalButton(page).click();
    await expect(ticketModalHeading(page)).toHaveCount(0);
  });
});

test.describe('Teacher Help Center - Submit Support Ticket (real backend)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('a real submission reaches the real backend and closes the modal (sends one real support email)', async ({ page }) => {
    await openHelpCenter(page);
    await ticketCard(page).click();
    await expect(ticketModalHeading(page)).toBeVisible({ timeout: 10000 });

    await ticketSubjectInput(page).fill('[E2E TEST - ignore] Automated Help Center suite run (teacher)');
    await ticketMessageInput(page).fill('This ticket was submitted by the Help Center Playwright suite to prove POST /help/ticket is wired correctly end-to-end for the teacher persona. No action needed.');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/help/ticket')),
      submitTicketButton(page).click(),
    ]);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    await expect(ticketModalHeading(page)).toHaveCount(0, { timeout: 10000 });
  });
});

test.describe('Teacher Help Center - Browse Topics', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('opening a topic shows its heading, description, and its own articles', async ({ page }) => {
    await openHelpCenter(page);
    await topicRow(page, 'Learning Paths').click();

    await expect(topicModalHeading(page, 'Learning Paths')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Courses, levels, subjects', { exact: true })).toBeVisible();
    for (const article of [
      'Starting a new learning path',
      'Understanding levels (locked, active, complete)',
      'Switching between subjects',
      'Weekly focus and milestones',
    ]) {
      await expect(articleRow(page, article)).toBeVisible();
    }
    await expect(articleRow(page, 'What the AI Coach can do')).toHaveCount(0);
  });

  test('clicking an article expands its content inline, clicking again collapses it', async ({ page }) => {
    await openHelpCenter(page);
    await topicRow(page, 'XP & Streaks').click();
    await expect(topicModalHeading(page, 'XP & Streaks')).toBeVisible({ timeout: 10000 });

    const article = articleRow(page, 'How XP points are calculated');
    await article.click();
    await expect(page.getByText('You earn XP for every activity: +10 per correct answer, +25 per lesson, +50 per level, +100 per challenge.', { exact: true })).toBeVisible();

    await article.click();
    await expect(page.getByText('You earn XP for every activity: +10 per correct answer, +25 per lesson, +50 per level, +100 per challenge.', { exact: true })).toHaveCount(0);
  });

  test('Close button closes the topic modal without navigating away', async ({ page }) => {
    await openHelpCenter(page);
    await topicRow(page, 'Badges').click();
    await expect(topicModalHeading(page, 'Badges')).toBeVisible({ timeout: 10000 });

    await closeTopicModalButton(page).click();

    await expect(topicModalHeading(page, 'Badges')).toHaveCount(0);
    await expect(page.getByText('How can we', { exact: false })).toBeVisible();
  });

  test('"Go to Account & Profile" closes the modal and navigates to the real Settings screen', async ({ page }) => {
    await openHelpCenter(page);
    await topicRow(page, 'Account & Profile').click();
    await expect(topicModalHeading(page, 'Account & Profile')).toBeVisible({ timeout: 10000 });

    await goToTopicButton(page, 'Account & Profile').click();

    await expect(topicModalHeading(page, 'Account & Profile')).toHaveCount(0);
    await expect(page.getByText('Settings', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Teacher Help Center - FAQ accordion', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('clicking a question expands its answer, clicking again collapses it', async ({ page }) => {
    await openHelpCenter(page);
    const q = faqQuestion(page, 'How does the AI Coach work?');
    await q.scrollIntoViewIfNeeded();
    await q.click();

    await expect(faqAnswer(page, 'The AI Coach uses your progress data to suggest topics, answer questions, and provide personalised learning help. Just type your question in the chat.')).toBeVisible();

    await q.click();
    await expect(faqAnswer(page, 'The AI Coach uses your progress data to suggest topics, answer questions, and provide personalised learning help. Just type your question in the chat.')).toHaveCount(0);
  });

  test('only one FAQ is open at a time - opening a second closes the first', async ({ page }) => {
    await openHelpCenter(page);
    const first = faqQuestion(page, 'How do I start a new learning path?');
    const third = faqQuestion(page, 'Can I change my study schedule?');

    await first.click();
    await expect(faqAnswer(page, 'Go to "My Learning Paths" in the sidebar, then select a subject. Tap "Start" on any available level to begin.')).toBeVisible();

    await third.scrollIntoViewIfNeeded();
    await third.click();
    await expect(faqAnswer(page, 'Yes! Go to Schedule and tap the "+" button to add a new study session. You can set the title, time, duration, and color.')).toBeVisible();
    await expect(faqAnswer(page, 'Go to "My Learning Paths" in the sidebar, then select a subject. Tap "Start" on any available level to begin.')).toHaveCount(0);
  });
});
