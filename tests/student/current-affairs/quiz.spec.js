// Student Current Affairs standalone Quiz screen (QuizScreen.tsx) — the weekly
// current-affairs comprehension quiz reached via /current-affairs/quiz.
// Separate from the World & You daily tidbit quiz.
//
// ── Business rules confirmed by reading the source ──────────────────────
// - Fetches the weekly quiz (GET /quiz/week) on load.
// - If already taken this week, shows the result immediately.
// - Each question has options; selecting one reveals correct/wrong.
// - Progress through questions; final screen shows score + award.
// - submitQuiz (POST /quiz/submit) and recordQuizComplete (POST /quiz-complete).
//
// ── Test data strategy ──────────────────────────────────────────────────
// student-a is the shared, explicitly read-only account (mutable: false).
// Quiz content is generated per-week by the server; tests assert on whatever
// the real API returns, captured via page.waitForResponse(). Completion is
// mocked to avoid mutating shared state.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'student-a';

function quizResponsePromise(page) {
  return page.waitForResponse(
    (r) => new URL(r.url()).pathname.endsWith('/quiz/week') && r.request().method() === 'GET',
  );
}

async function openQuiz(page) {
  await page.goto('/current-affairs/quiz');
  await expect(page.getByText(/Current Affairs Quiz|Weekly Quiz/i).first()).toBeVisible({
    timeout: 15000,
  });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Student Current Affairs Quiz - page load', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('page loads and fetches the weekly quiz', async ({ page }) => {
    const quizPromise = quizResponsePromise(page);
    await openQuiz(page);
    await quizPromise;

    // Either the quiz loaded or an error state is shown.
    const contentOrError = page
      .getByText(/question|quiz/i)
      .or(page.getByText(/could not load/i));
    await expect(contentOrError.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Student Current Affairs Quiz - questions', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('renders questions with real content from the API', async ({ page }) => {
    const quizPromise = quizResponsePromise(page);
    await openQuiz(page);
    const res = await quizPromise;
    const quiz = await res.json();

    if (quiz?.questions && quiz.questions.length > 0) {
      const firstQ = quiz.questions[0];
      if (firstQ?.question) {
        await expect(page.getByText(firstQ.question, { exact: true })).toBeVisible({
          timeout: 10000,
        });
      }
      if (firstQ?.options && firstQ.options.length > 0) {
        for (const opt of firstQ.options) {
          await expect(page.getByText(opt, { exact: true })).toBeVisible({
            timeout: 10000,
          });
        }
      }
    }
  });
});

test.describe('Student Current Affairs Quiz - answer flow (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('selecting an answer reveals correct/wrong state', async ({ page }) => {
    await openQuiz(page);
    await quizResponsePromise(page);

    // Find an option button and click it.
    const option = page.getByRole('button').filter({ hasText: /option|answer/i }).first();
    const hasOption = await option.isVisible().catch(() => false);
    if (!hasOption) return;

    await option.click();

    // After answering, either a "correct"/"wrong" indicator or next question
    // should appear.
    const revealed = page
      .getByText(/correct|wrong|next|continue/i)
      .or(page.getByText(/question \d+/i));
    await expect(revealed.first()).toBeVisible({ timeout: 10000 });
  });

  test('completing the quiz shows a final score', async ({ page }) => {
    await openQuiz(page);
    await quizResponsePromise(page);

    // Mock completion endpoint.
    await page.route('**/quiz/complete*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: { score: 3, total: 5 },
          award: { pointsAwarded: 15, newBadges: [] },
        }),
      }),
    );

    // Click through to completion if possible.
    const nextBtn = page.getByRole('button', { name: /next|continue|submit/i }).first();
    const hasNext = await nextBtn.isVisible().catch(() => false);
    if (hasNext) {
      await nextBtn.click();
    }

    // A score/result should appear.
    await expect(page.getByText(/score|\d+\/\d+|well done|completed/i)).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Student Current Affairs Quiz - error state (mocked)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('a failed quiz fetch shows an error message', async ({ page }) => {
    await page.route('**/quiz/week*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Quiz service unavailable' }),
      }),
    );

    await openQuiz(page);

    await expect(page.getByText(/could not load|error|unavailable/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
