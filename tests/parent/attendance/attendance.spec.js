// Parent Attendance Portal (/parent/attendance) - a school-linked parent sees
// their child's Present/Absent/Late counts and this month's detailed logs.
//
// The dashboard's Attendance Record card is already covered by
// tests/parent/dashboard/weekly-snapshot/weekly-snapshot.spec.js (parent-f2/f3);
// this file covers the separate Attendance Portal screen. It has no sidebar
// entry (only an App.tsx linking path), so it is opened by URL.
//
// parent-f2 / student-parent-f2: display only (no writes).
// parent-f4 / student-parent-f4: marks attendance. Its other spec (Subject
// Performance quiz) never reads attendance, so the domains don't overlap.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { accountFor } from '../../helpers/accounts.js';
import { getChildIdByParentEmail, markAttendance } from '../../helpers/api.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';
import { parentAttendancePortal, statCard } from '../../helpers/attendanceLocators.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3007';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// read-only expected-value lookup
async function summaryFor(request, studentId) {
  const res = await request.get(`${BACKEND_URL}/attendance/student/${studentId}/summary`);
  return res.json();
}

async function openPortal(page) {
  await page.goto('/parent/attendance');
  await dismissAnnouncementIfPresent(page);
  await expect(parentAttendancePortal(page)).toBeVisible({ timeout: 30000 });
}

async function expectStat(page, label, value) {
  await expect(statCard(page, label).getByText(String(value), { exact: true })).toBeVisible({ timeout: 15000 });
}

test.describe('Parent Attendance Portal - display (parent-f2)', () => {
  const PARENT = 'parent-f2';
  const STUDENT = 'student-parent-f2';
  test.use({ storageState: statePath(PARENT) });

  test("shows the child's real Present / Absent / Late counts, or the empty message", async ({ context, page, request }) => {
    const studentId = await getChildIdByParentEmail(request, {
      parentEmail: accountFor(PARENT).email,
      childEmail: accountFor(STUDENT).email,
    });
    const { summary } = await summaryFor(request, studentId);

    await applySession(context, PARENT);
    await openPortal(page);

    if (summary.total === 0) {
      await expect(page.getByText('Attendance is not yet updated by the school.')).toBeVisible({ timeout: 15000 });
    } else {
      await expectStat(page, 'Present', summary.present);
      await expectStat(page, 'Absent', summary.absent);
      await expectStat(page, 'Late', summary.late);
      await expect(page.getByText(`${summary.ratePct}%`, { exact: true }).first()).toBeVisible();
    }
  });
});

test.describe('Parent Attendance Portal - a new mark shows up (parent-f4)', () => {
  const PARENT = 'parent-f4';
  const STUDENT = 'student-parent-f4';
  test.use({ storageState: statePath(PARENT) });

  test("a 'late' mark for today appears in the counts and in this month's detailed logs", async ({ context, page, request }) => {
    const studentId = await getChildIdByParentEmail(request, {
      parentEmail: accountFor(PARENT).email,
      childEmail: accountFor(STUDENT).email,
    });
    // Setup: the teacher's mark (a different persona), made through the API.
    await markAttendance(request, { date: todayISO(), studentId, status: 'late' });
    const { summary } = await summaryFor(request, studentId);

    await applySession(context, PARENT);
    await openPortal(page);

    await expectStat(page, 'Late', summary.late);
    await expect(page.getByText('Detailed Logs', { exact: true })).toBeVisible();
    await expect(page.getByText('Late arrival recorded. Student checked-in post homeroom.').first()).toBeVisible();
  });
});
