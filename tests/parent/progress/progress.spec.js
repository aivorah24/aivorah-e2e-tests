// Feature: Parent Progress & Reports.
//
// Covers the real parent UI journey in ParentProgressScreen. API calls are
// setup/read-only expected-value lookups; final assertions are rendered UI.

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { applySession, statePath } from '../../helpers/auth.js';
import { accountFor } from '../../helpers/accounts.js';
import {
  completeLesson,
  getChildIdByParentEmail,
  getChildrenByParentEmail,
  getStudentStats,
  setStudentStats,
  trackQuizResult,
} from '../../helpers/api.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const READ_ONLY_PARENT = 'parent-e';
const MUTABLE_PARENT = 'parent-f7';
const MUTABLE_STUDENT = 'student-parent-f7';
const LEADERBOARD_SERVICE = process.env.LEADERBOARD_SERVICE_URL || 'http://localhost:4003';
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatStudyTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

async function openProgress(page) {
  await page.goto('/parent/progress');
  await dismissAnnouncementIfPresent(page);
  await expect(page.getByText('Progress & Reports', { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

async function getWeekly(request, childId) {
  const res = await request.get(`${LEADERBOARD_SERVICE}/student/${childId}/weekly`);
  if (!res.ok()) throw new Error(`GET /student/${childId}/weekly failed: ${res.status()}`);
  return res.json();
}

async function getMistakeTrends(request, childId) {
  const res = await request.get(`${LEADERBOARD_SERVICE}/student/${childId}/mistake-trends`);
  return res.ok() ? res.json() : null;
}

async function setCompletedTopicsForSetup(studentId, completedTopics) {
  const { error } = await supabaseAdmin
    .from('student_stats')
    .upsert({
      student_id: studentId,
      completed_topics: completedTopics,
      topics_explored: completedTopics.length,
      last_lesson: completedTopics[completedTopics.length - 1] || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id' });
  if (error) throw new Error(`Supabase setup failed for completed_topics: ${error.message}`);
}

test.describe('Parent Progress - real stats and child switching', () => {
  test.use({ storageState: statePath(READ_ONLY_PARENT) });

  test('renders hero chips, curriculum progress, milestone dots, and weekly chart from real child data', async ({ context, page, request }) => {
    const parentEmail = accountFor(READ_ONLY_PARENT).email;
    const children = await getChildrenByParentEmail(request, parentEmail);
    const child = children[0];
    const stats = await getStudentStats(request, child.id);
    const weekly = await getWeekly(request, child.id);
    const completedTopics = stats.completedTopics ?? [];
    const totalTopics = stats.totalTopics || completedTopics.length || 1;
    const pct = Math.min(100, Math.round((completedTopics.length / totalTopics) * 100));

    await applySession(context, READ_ONLY_PARENT);
    await openProgress(page);

    await expect(page.getByText(child.name, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText((stats.xpPoints ?? 0).toLocaleString(), { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(`Lv.${stats.level ?? 1}`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(String(stats.currentStreak ?? 0), { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(formatStudyTime(stats.studyTimeMinutes ?? 0), { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(`${completedTopics.length} of ${totalTopics} topics completed`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(`${pct}%`, { exact: true }).filter({ visible: true }).first()).toBeVisible();

    for (const mark of ['0%', '25%', '50%', '75%', '100%']) {
      await expect(page.getByText(mark, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    await expect(page.getByText('This Week', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(`${formatStudyTime((weekly.days ?? []).reduce((sum, day) => sum + (day.studyMinutes ?? 0), 0))} total`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('switching children updates every progress section for the newly selected child', async ({ context, page, request }) => {
    const parentEmail = accountFor(READ_ONLY_PARENT).email;
    const children = await getChildrenByParentEmail(request, parentEmail);
    expect(children.length, 'parent-e should have two linked children').toBeGreaterThanOrEqual(2);

    await applySession(context, READ_ONLY_PARENT);
    await openProgress(page);

    for (const child of children.slice(0, 2)) {
      const stats = await getStudentStats(request, child.id);
      const completedTopics = stats.completedTopics ?? [];
      const totalTopics = stats.totalTopics || completedTopics.length || 1;
      await page.getByText(child.name, { exact: true }).filter({ visible: true }).first().click();

      await expect(page.getByText(child.name, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(child.grade, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(`${completedTopics.length} of ${totalTopics} topics completed`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(formatStudyTime(stats.studyTimeMinutes ?? 0), { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('Subject Progress', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('Practice Tests', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('AI Insights', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('Topics to Review', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test.fixme('documents current bug: fallback Subject Progress is curriculum-blind and uses only four hardcoded subjects', async ({ context, page }) => {
    await applySession(context, READ_ONLY_PARENT);
    await openProgress(page);
    for (const subject of ['Mathematics', 'Science', 'English', 'Social Studies']) {
      await expect(page.getByText(subject, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
  });
});

test.describe('Parent Progress - empty and populated performance sections', () => {
  test.use({ storageState: statePath(MUTABLE_PARENT) });

  test('shows empty practice/AI/review states before practice data exists', async ({ context, page, request }) => {
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const trends = await getMistakeTrends(request, childId);
    expect((trends?.topics ?? []).length, 'mutable child should start without practice trend data').toBe(0);

    await applySession(context, MUTABLE_PARENT);
    await openProgress(page);

    await expect(page.getByText('No practice tests yet', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Take practice tests to unlock AI insights', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('No practice tests taken yet', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('shows achievements, recommended review topics, and AI insights after real underlying performance exists', async ({ context, page, request }) => {
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const studentEmail = accountFor(MUTABLE_STUDENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: studentEmail });
    const before = await getStudentStats(request, childId);

    try {
      await setStudentStats(request, childId, {
        currentStreak: 2,
        xpPoints: Math.max(before.xpPoints ?? 0, 250),
        level: Math.max(before.level ?? 1, 3),
        studyTimeMinutes: 135,
      });
      await completeLesson(request, childId, {
        topic: 'E2E Progress Fractions',
        subject: 'Mathematics',
        grade: 'Grade 4',
        curriculum: 'NCERT',
      });
      await trackQuizResult(request, {
        studentEmail,
        curriculum: 'NCERT',
        topic: 'E2E Progress Fractions',
        subject: 'Mathematics',
        score: 100,
      });

      await applySession(context, MUTABLE_PARENT);
      await openProgress(page);

      await expect(page.getByText('Streak Starter', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText('Perfect Score', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText('E2E Progress Fractions', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(/Strong in E2E Progress Fractions|Study consistency improving/).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
    } finally {
      await setStudentStats(request, childId, {
        currentStreak: before.currentStreak ?? 0,
        xpPoints: before.xpPoints ?? 0,
        level: before.level ?? 1,
      });
      await setCompletedTopicsForSetup(childId, before.completedTopics ?? []);
    }
  });

  test('milestone threshold states render at 25, 50, 75, and 100 percent boundaries', async ({ context, page, request }) => {
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const before = await getStudentStats(request, childId);
    const realTotalTopics = before.totalTopics || Math.max((before.completedTopics ?? []).length, 1);
    const thresholds = [25, 50, 75, 100].map((pct) => ({
      pct,
      completed: Math.max(1, Math.ceil((realTotalTopics * pct) / 100)),
    }));

    try {
      for (const threshold of thresholds) {
        await setCompletedTopicsForSetup(
          childId,
          Array.from({ length: threshold.completed }, (_, i) => `E2E milestone ${threshold.pct} ${i + 1}`),
        );
        await applySession(context, MUTABLE_PARENT);
        await openProgress(page);
        const expectedPct = Math.min(100, Math.round((threshold.completed / realTotalTopics) * 100));
        await expect(page.getByText(`${threshold.completed} of ${realTotalTopics} topics completed`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(`${expectedPct}%`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      }
    } finally {
      await setCompletedTopicsForSetup(childId, before.completedTopics ?? []);
    }
  });
});
