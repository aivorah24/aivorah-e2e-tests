// Teacher Attendance - a school-linked teacher opens Attendance from the
// sidebar, sees today's roster for their class, marks a student, saves, and
// the mark is still there after a reload.
//
// Phase-1 baseline for the Attendance migration (the feature is monolith-only:
// ai-mentor/server/routes/attendance.js). Known when written (2026-10-05):
//   - TeacherAttendance is not registered in TeacherNavigator and has no
//     App.tsx linking path, so the sidebar's "Attendance" item opens nothing and
//     there is no URL for it. The refactor is expected to add /teacher/attendance;
//     these tests open that URL (sidebar clicks are flaky here, same reason
//     scheduleLocators.js navigates by URL);
//   - no E2E teacher has a class (/classes/mine is empty for teacher-a/b/d).
// Both make these tests fail until the refactor lands.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';
import {
  sidebarAttendanceLink,
  teacherAttendanceScreen,
  saveAttendanceButton,
  statCard,
} from '../../helpers/attendanceLocators.js';

const ACCOUNT = 'teacher-a';

async function openAttendance(page) {
  await page.goto('/teacher/attendance');
  await dismissAnnouncementIfPresent(page);
  await expect(teacherAttendanceScreen(page)).toBeVisible({ timeout: 30000 });
}

async function statNumber(page, label) {
  return Number(((await statCard(page, label).innerText()).match(/\d+/) || ['0'])[0]);
}

test.describe('Teacher Attendance', () => {
  test.use({ storageState: statePath(ACCOUNT) });
  test.beforeEach(async ({ context }) => { await applySession(context, ACCOUNT); });

  test('the sidebar lists Attendance, and the Attendance screen opens', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Good (morning|afternoon|evening),/).first()).toBeVisible({ timeout: 30000 });
    await expect(sidebarAttendanceLink(page)).toBeVisible();
    await openAttendance(page);
    await expect(saveAttendanceButton(page)).toBeVisible();
  });

  test('marking a student absent and saving is still shown after a reload', async ({ page }) => {
    await openAttendance(page);
    // The first class is selected automatically. nth(0) is the "Absent" stat
    // label; the per-student "Absent" buttons follow it.
    const absent = page.getByText('Absent', { exact: true }).filter({ visible: true });
    await expect(absent.nth(1), 'teacher-a needs a class with at least one student').toBeVisible({ timeout: 15000 });

    await absent.nth(1).click();
    const absentCount = await statNumber(page, 'Absent');
    expect(absentCount).toBeGreaterThan(0);
    await saveAttendanceButton(page).click();

    await page.reload();
    await dismissAnnouncementIfPresent(page);
    await expect(teacherAttendanceScreen(page)).toBeVisible({ timeout: 30000 });
    await expect(statCard(page, 'Absent').getByText(String(absentCount), { exact: true })).toBeVisible({ timeout: 15000 });
  });
});
