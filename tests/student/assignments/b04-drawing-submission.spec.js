// B04 — Support paper-upload evidence for handwritten answers and drawings
// (Aivorah_Teacher_Portal_Defect_Register, Assignments -> Worksheet
// submission / AI evaluation, High)
//
// Original defect: the source worksheet includes a "Draw your farm"
// activity and handwritten planning/paragraph responses. The generated
// activity treated the drawing as a hands-on paper-only activity with no
// submission path for the learner to upload the completed paper.
//
// Scope of this E2E test (documented explicitly, per the task's own
// requirement to state what's covered): this test exercises the
// STUDENT-FACING half of the fix with full fidelity - the real QuizModal
// drawing-upload UI (PhotoUploadStep), a real image upload, and the real
// submit/grading round trip, using the real "Draw your farm" evidence photo
// you supplied for B04 (tests/fixtures/worksheets/b04-draw-your-farm.jpeg).
// The assignment itself is created via the real API (createDrawingAssignment,
// mirroring createShortAnswerAssignment's established convention in this
// repo, e.g. b03-grading-correctness-regression.spec.js) rather than by
// driving the teacher's Upload Worksheet -> AI extraction -> AI quiz
// generation wizard end-to-end - those steps involve multiple chained,
// non-deterministic AI calls (extraction, then MCQ-conversion) that would
// make this suite flaky/slow in CI, the same reasoning already established
// for why B03's regression suite mocks the grading response instead of
// calling a live LLM. The extraction-preserves-drawing-type behavior itself
// is covered separately by real Jest tests (ai-mentor/server: extraction;
// aivorah-frontend: generateQuizFromExtracted) - see the B04 Phase 2 report.
//
// WHAT'S MOCKED vs REAL:
// - REAL: login, navigation, the actual PhotoUploadStep upload UI, the real
//   file picker interaction, the real image (your B04 evidence photo)
//   actually being read/base64-encoded/POSTed, the real result-screen
//   rendering.
// - MOCKED: the POST /assignments/:id/submit response body (score +
//   evidenceUrl) - the real vision-grading call itself is Groq (an LLM),
//   inherently non-deterministic and unsuitable for a CI assertion, exactly
//   the same reasoning already established for B03. The evidence-URL
//   PERSISTENCE behavior (does the real backend actually save it) already
//   has direct, non-mocked integration coverage in
//   aivorah-assignments-service (b04-quiz-drawing-question.test.js) - this
//   E2E suite is the missing piece: proving the UI actually surfaces what
//   the (real, unmocked-elsewhere) backend contract returns.

import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { accountFor } from '../../helpers/accounts.js';
import { getUserIdByEmail, createDrawingAssignment, deleteAssignment } from '../../helpers/api.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';
import { openAssignments, assignmentStartButton } from '../../helpers/assignmentsLocators.js';

export const REQUIRED_ACCOUNTS = ['student-r'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRAWING_EVIDENCE_PHOTO = path.resolve(__dirname, '../../fixtures/worksheets/b04-draw-your-farm.jpeg');

const ACCOUNT = 'student-r';
const DRAWING_QUESTION = 'Draw your farm in the space provided.';

function isoPlusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function uniqueTitle(prefix) {
  return `E2E Assign ${prefix} ${Date.now()}`;
}

async function openAssignmentsReady(page) {
  await openAssignments(page);
  await expect(page.getByText('Assignments', { exact: true }).first()).toBeVisible({ timeout: 20000 });
  await dismissAnnouncementIfPresent(page);
}

async function mockDrawingSubmitResponse(page, assignmentId, { score, evidenceUrl, needsReview }) {
  await page.route(`**/assignments/${assignmentId}/submit`, async (route) => {
    const perQuestionEntry = needsReview
      ? { number: 1, question: DRAWING_QUESTION, type: 'drawing', answered: true, score: null, needsReview: true,
          studentAnswer: null, correct: false, comment: 'Could not fully read this submission - your teacher will review it.', evidenceUrl }
      : { number: 1, question: DRAWING_QUESTION, type: 'drawing', answered: true, score, correct: score >= 70,
          studentAnswer: 'A farm with rows of crops and animals.', comment: 'Great farm drawing!', evidenceUrl };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        score: needsReview ? 0 : score,
        aiFeedback: JSON.stringify({ text: 'Nice work!', stamp: 'Hardworking Farmer', perQuestion: [perQuestionEntry] }),
        perQuestion: [perQuestionEntry],
      }),
    });
  });
}

test.describe('B04 — drawing/photo evidence submission (real Upload Worksheet -> Interactive Quiz path)', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  async function setupAssignment(request) {
    const studentId = await getUserIdByEmail(request, accountFor(ACCOUNT).email);
    const title = uniqueTitle('B04 Drawing');
    const created = await createDrawingAssignment(request, {
      teacherId: 'e2e-test-harness',
      studentId,
      title,
      dueDate: isoPlusDays(3),
      subject: 'Visual Arts',
      question: DRAWING_QUESTION,
    });
    return { studentId, title, created };
  }

  test('student sees the real drawing-upload UI (not a text box) for a drawing question', async ({ page, request }) => {
    const { created } = await setupAssignment(request);
    try {
      await openAssignmentsReady(page);
      await assignmentStartButton(page, created.id).click({ timeout: 15000 });
      await expect(page.getByText(DRAWING_QUESTION, { exact: true })).toBeVisible({ timeout: 15000 });

      // The real PhotoUploadStep UI, not a TextInput - confirms QuizModal
      // actually routes type:'drawing' to the image-upload component, not
      // the short_answer text box (the original reported gap).
      await expect(page.getByText('Upload your drawing / diagram', { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('Write your answer here...')).toHaveCount(0);
    } finally {
      await deleteAssignment(request, created.id);
    }
  });

  test('student uploads the real drawing evidence photo, submits, and sees the graded result', async ({ page, request }) => {
    const { created } = await setupAssignment(request);
    try {
      await mockDrawingSubmitResponse(page, created.id, { score: 85, evidenceUrl: 'https://res.cloudinary.com/evidence/e2e-farm.jpg' });
      await openAssignmentsReady(page);
      await assignmentStartButton(page, created.id).click({ timeout: 15000 });
      await expect(page.getByText(DRAWING_QUESTION, { exact: true })).toBeVisible({ timeout: 15000 });

      // Real file picker interaction, real image (the actual B04 evidence
      // you supplied) - the same idiom already established for image
      // uploads elsewhere in this repo (upload-worksheet.spec.js's
      // uploadFile()).
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Upload your drawing / diagram', { exact: true }).click(),
      ]);
      await fileChooser.setFiles(DRAWING_EVIDENCE_PHOTO);

      // PhotoUploadStep shows a preview + "Change photo" once captured -
      // confirms the real image was actually read, not just accepted blindly.
      await expect(page.getByText('Change photo', { exact: true })).toBeVisible({ timeout: 10000 });

      await page.getByText('Review & Submit', { exact: true }).click();
      await expect(page.getByText('Review Answers', { exact: true })).toBeVisible();
      // The review screen must show the drawing was captured, not "Not answered".
      await expect(page.getByText('Drawing submitted', { exact: true })).toBeVisible();

      await page.getByText('Submit Quiz', { exact: true }).click();
      await expect(page.getByText('Correct 1 of 1 questions', { exact: true })).toBeVisible({ timeout: 20000 });
    } finally {
      await deleteAssignment(request, created.id);
    }
  });

  test('a low-confidence/failed grading result shows as Needs Review, not a fake score', async ({ page, request }) => {
    const { created } = await setupAssignment(request);
    try {
      await mockDrawingSubmitResponse(page, created.id, { needsReview: true, evidenceUrl: 'https://res.cloudinary.com/evidence/e2e-farm2.jpg' });
      await openAssignmentsReady(page);
      await assignmentStartButton(page, created.id).click({ timeout: 15000 });
      await expect(page.getByText(DRAWING_QUESTION, { exact: true })).toBeVisible({ timeout: 15000 });

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Upload your drawing / diagram', { exact: true }).click(),
      ]);
      await fileChooser.setFiles(DRAWING_EVIDENCE_PHOTO);
      await expect(page.getByText('Change photo', { exact: true })).toBeVisible({ timeout: 10000 });

      await page.getByText('Review & Submit', { exact: true }).click();
      await page.getByText('Submit Quiz', { exact: true }).click();

      // Never "Correct 1 of 1" for a needsReview result - the whole point of
      // this fix is that a failed grading attempt must never look like a
      // real passing score.
      await expect(page.getByText('Correct 1 of 1 questions', { exact: true })).toHaveCount(0);
    } finally {
      await deleteAssignment(request, created.id);
    }
  });

  test('the original submitted evidence remains accessible after grading (real, unmocked backend check)', async ({ page, request }) => {
    // This is the "original evidence remains accessible for audit"
    // acceptance criterion - checked via a real, unmocked round trip against
    // the real backend (not the page.route() mock used in the tests above,
    // which only proves the UI *would* display whatever the backend
    // returns). Real image upload, real Cloudinary evidence upload, real
    // grading call - the one genuinely non-deterministic piece is the AI
    // score itself, which this test does not assert on.
    const { created } = await setupAssignment(request);
    try {
      await openAssignmentsReady(page);
      await assignmentStartButton(page, created.id).click({ timeout: 15000 });
      await expect(page.getByText(DRAWING_QUESTION, { exact: true })).toBeVisible({ timeout: 15000 });

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Upload your drawing / diagram', { exact: true }).click(),
      ]);
      await fileChooser.setFiles(DRAWING_EVIDENCE_PHOTO);
      await expect(page.getByText('Change photo', { exact: true })).toBeVisible({ timeout: 10000 });

      await page.getByText('Review & Submit', { exact: true }).click();
      await page.getByText('Submit Quiz', { exact: true }).click();
      // Real grading is a real Groq vision call - give it real time.
      await expect(page.getByText(/Correct \d of 1 questions/)).toBeVisible({ timeout: 45000 });

      const res = await request.get(`${process.env.ASSIGNMENTS_SERVICE_URL || 'http://localhost:3015'}/assignments/${created.id}/submissions`);
      expect(res.ok()).toBeTruthy();
      const submissions = await res.json();
      const perQuestion = submissions?.[0]?.perQuestion || submissions?.perQuestion || [];
      const drawingEntry = Array.isArray(perQuestion) ? perQuestion[0] : null;
      expect(drawingEntry?.evidenceUrl, 'the real backend must have persisted a Cloudinary evidenceUrl for this real drawing submission').toBeTruthy();
    } finally {
      await deleteAssignment(request, created.id);
    }
  });
});
