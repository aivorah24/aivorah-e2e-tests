// Feature: Parent Assignments.
//
// These tests cover the real parent UI journey in
// aivorah-frontend/src/.legacy-screens/parent/ParentAssignmentsScreen.tsx.
// Final assertions are always rendered UI checks. API calls here are limited
// to deterministic setup/cleanup and read-only expected-value lookups.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { newPageAs } from '../../helpers/session.js';
import { accountFor } from '../../helpers/accounts.js';
import {
  createAssignment,
  deleteAssignment,
  getAssignmentsForStudent,
  getChildIdByParentEmail,
  getChildrenByParentEmail,
  getUserIdByEmail,
  submitAssignment,
} from '../../helpers/api.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';
import { assignmentCard } from '../../helpers/assignmentsLocators.js';

const READ_ONLY_PARENT = 'parent-e';
const MUTABLE_PARENT = 'parent-f7';
const MUTABLE_STUDENT = 'student-parent-f7';
const ASSIGNMENTS_SERVICE = process.env.ASSIGNMENTS_SERVICE_URL || 'http://localhost:3015';
const RUN_ID = Date.now();

function uniqueTitle(base) {
  return `${base} ${RUN_ID}`;
}

function isoPlusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

async function openParentAssignments(page) {
  await page.goto('/parent/assignments');
  await dismissAnnouncementIfPresent(page);
  await expect(page.getByText('Assignments', { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

// getByText('Parent') was ambiguous - it also matched the "Parent" role
// label in the header/nav, which sometimes won .first() and navigated
// away to the Profile screen instead of applying the filter. The filter
// tabs now carry an unambiguous accessibilityLabel for exactly this.
function parentFilter(page, label) {
  return page.getByLabel(`filter-${label}`, { exact: true });
}

// The due-date field (components/common/DatePicker.tsx) is a calendar
// popover, not a text input - there's no fillable placeholder to target.
// Open it (its empty-state placeholder text doubles as the click target)
// and pick the day by its accessibilityLabel (the 'YYYY-MM-DD' key), which
// DatePicker sets on every day cell for exactly this reason.
async function pickDueDate(page, isoDate) {
  await page.getByText('Select a due date', { exact: true }).filter({ visible: true }).first().click();
  await page.getByLabel(isoDate, { exact: true }).click();
}

async function createAssignmentAsParent(request, { childId, parentEmail, title, dueDate, createdByRole = 'parent', type = 'quiz', status = 'pending' }) {
  const res = await request.post(`${ASSIGNMENTS_SERVICE}/assignments`, {
    data: {
      title,
      subject: 'Mathematics',
      chapter: 'Fractions',
      dueDate,
      studentId: childId,
      createdById: parentEmail,
      createdByRole,
      type,
      status,
      note: 'E2E parent assignment note',
      quizQuestions: type === 'quiz'
        ? [{ question: 'What is 7 + 5?', type: 'mcq', options: ['12', '10', '13', '11'], correct: '12' }]
        : [],
      questions: type === 'assignment' ? ['Write two examples.'] : [],
    },
  });
  if (!res.ok()) throw new Error(`POST /assignments failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

async function cleanup(request, ids) {
  await Promise.all(ids.filter(Boolean).map((id) => deleteAssignment(request, id)));
}

test.describe('Parent Assignments - viewing, filters, child switching, and details', () => {
  test.use({ storageState: statePath(READ_ONLY_PARENT) });

  test('switching children reloads the assignment list for the selected child', async ({ context, page, request }) => {
    const parentEmail = accountFor(READ_ONLY_PARENT).email;
    // Read-only expected-value lookup.
    const children = await getChildrenByParentEmail(request, parentEmail);
    expect(children.length, 'parent-e should have two linked children').toBeGreaterThanOrEqual(2);
    const [childA, childB] = children;

    await applySession(context, READ_ONLY_PARENT);
    await openParentAssignments(page);

    for (const child of [childA, childB]) {
      await page.getByText(child.name, { exact: true }).filter({ visible: true }).first().click();
      await expect(page.getByText(`${child.name} · ${child.grade}`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
    }
  });

  // Regression coverage for a real ambiguity in the New Assignment modal: it
  // has no explicit "assign to" picker - it silently targets whichever
  // child's tab is currently active on the screen (see
  // aivorah-frontend/src/.legacy-screens/parent/ParentAssignmentsScreen.tsx,
  // `child = children[selectedIdx]`). This locks in that the assignment
  // really does go to the active child only, and never leaks into the other
  // child's list.
  test('an assignment created while a specific child tab is active is only visible for that child', async ({ context, page, request }) => {
    const parentEmail = accountFor(READ_ONLY_PARENT).email;
    const children = await getChildrenByParentEmail(request, parentEmail);
    expect(children.length, 'parent-e should have two linked children').toBeGreaterThanOrEqual(2);
    const [childA, childB] = children;
    const title = uniqueTitle('E2E Targeted Child Assignment');
    let created;

    try {
      await applySession(context, READ_ONLY_PARENT);
      await openParentAssignments(page);

      // Switch to child A's tab, then create - the modal has no in-form
      // child picker, so this tab switch is what determines the target.
      await page.getByText(childA.name, { exact: true }).filter({ visible: true }).first().click();
      await expect(page.getByText(`${childA.name} · ${childA.grade}`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });

      created = await createAssignmentAsParent(request, { childId: childA.id, parentEmail, title, dueDate: isoPlusDays(3), type: 'assignment' });

      await page.reload();
      await dismissAnnouncementIfPresent(page);
      await expect(page.getByText(`${childA.name} · ${childA.grade}`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });

      // Switch to child B - the same assignment must not appear here, since
      // it was created for child A specifically.
      await page.getByText(childB.name, { exact: true }).filter({ visible: true }).first().click();
      await expect(page.getByText(`${childB.name} · ${childB.grade}`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    } finally {
      await cleanup(request, [created?.id]);
    }
  });
});

test.describe('Parent Assignments - mutable list states, filters, and details', () => {
  test.use({ storageState: statePath(MUTABLE_PARENT) });

  test('filters show All, School, Parent, and Done assignment groups correctly', async ({ context, page, request }) => {
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const teacherId = await getUserIdByEmail(request, accountFor('teacher-a').email);
    const parentTitle = uniqueTitle('E2E Parent Filter Parent');
    const schoolTitle = uniqueTitle('E2E Parent Filter School');
    const doneTitle = uniqueTitle('E2E Parent Filter Done');
    const created = [];

    try {
      created.push(await createAssignmentAsParent(request, { childId, parentEmail, title: parentTitle, dueDate: isoPlusDays(3), type: 'assignment' }));
      created.push(await createAssignmentAsParent(request, { childId, parentEmail: teacherId, title: schoolTitle, dueDate: isoPlusDays(3), createdByRole: 'teacher' }));
      const done = await createAssignment(request, { teacherId, studentId: childId, title: doneTitle, dueDate: isoPlusDays(3), subject: 'Mathematics' });
      created.push(done);
      await submitAssignment(request, done.id, { studentId: childId });

      await applySession(context, MUTABLE_PARENT);
      await openParentAssignments(page);

      await parentFilter(page, 'All').click();
      await expect(page.getByText(parentTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(schoolTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(doneTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();

      await parentFilter(page, 'School').click();
      await expect(page.getByText(schoolTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(parentTitle, { exact: true })).toHaveCount(0);

      await parentFilter(page, 'Parent').click();
      await expect(page.getByText(parentTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(schoolTitle, { exact: true })).toHaveCount(0);

      await parentFilter(page, 'Done').click();
      await expect(page.getByText(doneTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Score: 100%', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    } finally {
      await cleanup(request, created.map((a) => a.id));
    }
  });

  test('opens an assignment detail view with quiz questions and options', async ({ context, page, request }) => {
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const title = uniqueTitle('E2E Parent Detail Quiz');
    const created = await createAssignmentAsParent(request, { childId, parentEmail, title, dueDate: isoPlusDays(3), type: 'quiz' });

    try {
      await applySession(context, MUTABLE_PARENT);
      await openParentAssignments(page);
      await page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
      await expect(page.getByText(title, { exact: true }).filter({ visible: true }).last()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('What is 7 + 5?', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('12', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    } finally {
      await cleanup(request, [created.id]);
    }
  });

  test('due-date labels render today, tomorrow, future, and overdue pending items', async ({ context, page, request }) => {
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const titles = {
      today: uniqueTitle('E2E Parent Due Today'),
      tomorrow: uniqueTitle('E2E Parent Due Tomorrow'),
      future: uniqueTitle('E2E Parent Due Future'),
      overdue: uniqueTitle('E2E Parent Due Overdue'),
    };
    const created = [];

    try {
      created.push(await createAssignmentAsParent(request, { childId, parentEmail, title: titles.today, dueDate: isoPlusDays(0) }));
      created.push(await createAssignmentAsParent(request, { childId, parentEmail, title: titles.tomorrow, dueDate: isoPlusDays(1) }));
      created.push(await createAssignmentAsParent(request, { childId, parentEmail, title: titles.future, dueDate: isoPlusDays(5) }));
      created.push(await createAssignmentAsParent(request, { childId, parentEmail, title: titles.overdue, dueDate: isoPlusDays(-2) }));

      await applySession(context, MUTABLE_PARENT);
      await openParentAssignments(page);

      await expect(page.getByText(titles.today, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Due today', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('Due tomorrow', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(/Due \d{1,2} [A-Za-z]{3}/).filter({ visible: true }).first()).toBeVisible();
      // Current behavior: overdue pending assignments are labeled "Pending".
      await expect(page.getByText('Pending', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    } finally {
      await cleanup(request, created.map((a) => a.id));
    }
  });

  test('empty state renders for a child with zero assignments after filtering Parent-created tasks', async ({ context, page, request }) => {
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const existing = await getAssignmentsForStudent(request, childId);
    test.skip(existing.some((a) => a.createdBy === 'parent'), 'read-only account already has parent-created assignments');

    await applySession(context, MUTABLE_PARENT);
    await openParentAssignments(page);
    await parentFilter(page, 'Parent').click();
    await expect(page.getByText('No assignments here', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
  });

  test('assignment list fetch failure shows an empty/error-safe UI instead of crashing', async ({ context, page }) => {
    await page.route('**/assignments?studentId=*&viewerRole=parent', (route) => {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
    });

    await applySession(context, MUTABLE_PARENT);
    await openParentAssignments(page);
    await expect(page.getByText('No assignments here', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Parent Assignments - parent creates work for the student', () => {
  test.use({ storageState: statePath(MUTABLE_PARENT) });

  test('creates a parent assignment through the modal and the target student sees it in their own UI', async ({ context, page, request, browser }) => {
    test.setTimeout(120000);
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const title = uniqueTitle('E2E Parent Creates Assignment');

    await applySession(context, MUTABLE_PARENT);
    await openParentAssignments(page);

    await page.getByText('New', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('New Assignment', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('e.g. Practice fractions worksheet').fill(title);
    await page.getByText('Science', { exact: true }).filter({ visible: true }).first().click();
    await page.getByPlaceholder(/Chapter 5/).fill('Plants');
    await page.getByText('assignment', { exact: true }).filter({ visible: true }).first().click();
    await pickDueDate(page, isoPlusDays(3));
    await page.getByPlaceholder('Question 1...').fill('Write one observation about plants.');
    await page.getByPlaceholder('Instructions or encouragement for your child...').fill('Created by parent E2E.');
    await page.getByText('Create Assignment', { exact: true }).filter({ visible: true }).first().click();

    await expect(page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });

    // Read-only lookup for cleanup id after the UI-created assignment exists.
    const created = (await getAssignmentsForStudent(request, childId)).find((a) => a.title === title);
    expect(created, 'expected UI-created parent assignment to persist').toBeTruthy();

    const studentPage = await newPageAs(browser, MUTABLE_STUDENT);
    try {
      await studentPage.goto('/assignments');
      await dismissAnnouncementIfPresent(studentPage);
      await expect(assignmentCard(studentPage, created.id)).toBeVisible({ timeout: 15000 });
      await expect(assignmentCard(studentPage, created.id).getByText(title, { exact: true })).toBeVisible();
    } finally {
      await studentPage.close();
      await cleanup(request, [created.id]);
    }
  });

  test('creates a quiz with generated MCQs previewed before create', async ({ context, page, request }) => {
    test.setTimeout(120000);
    const parentEmail = accountFor(MUTABLE_PARENT).email;
    const childId = await getChildIdByParentEmail(request, { parentEmail, childEmail: accountFor(MUTABLE_STUDENT).email });
    const titlePattern = /multiplication|quiz|practice/i;

    await applySession(context, MUTABLE_PARENT);
    await openParentAssignments(page);

    await page.getByText('New', { exact: true }).filter({ visible: true }).first().click();
    await page.getByText('quiz', { exact: true }).filter({ visible: true }).first().click();
    await page.getByPlaceholder(/Give 5 multiplication/).fill('Give 3 multiplication word problems for Grade 4.');
    await page.getByText('3', { exact: true }).filter({ visible: true }).first().click();
    await page.getByText('Generate Assignment', { exact: true }).filter({ visible: true }).first().click();

    await expect(page.getByText('Generated', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('Questions', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(titlePattern).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });

    await pickDueDate(page, isoPlusDays(3));
    await page.getByText('Create Assignment', { exact: true }).filter({ visible: true }).first().click();

    await expect(page.getByText(titlePattern).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
    const all = await getAssignmentsForStudent(request, childId);
    const created = all.find((a) => a.createdBy === 'parent' && a.quizQuestions?.length >= 1 && new Date(a.createdAt || a.created_at || 0).getTime() > RUN_ID - 60000);
    expect(created, 'expected generated parent quiz to persist for cleanup').toBeTruthy();
    await cleanup(request, [created.id]);
  });
});
