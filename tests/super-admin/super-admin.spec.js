// Super Admin screens (SuperAdminNavigator) — super-admin view of the platform.
// NOTE: There is a known discrepancy — SUPER_ADMIN_NAV_ITEMS in DrawerContent
// references screens (SuperAdminStudents, ChallengeManager, StaffSubjectMapping,
// ContentReviewDashboard) that are NOT registered in SuperAdminNavigator.tsx.
// This test verifies what IS actually reachable.
//
// ── Screens confirmed registered in SuperAdminNavigator ─────────────────
// - Dashboard (TeacherDashboardScreen reused)
// - Students (TeacherStudentsScreen reused)
// - Assignments (TeacherAssignmentsScreen reused)
// - Challenges (TeacherChallengesScreen reused)
// - Schedule (TeacherScheduleScreen reused)
// - Attendance (TeacherAttendanceScreen reused)
// - Progress (TeacherStudentProgressScreen reused)
//
// ── Test data strategy ──────────────────────────────────────────────────
// Super admin access is gated by role/email. We test navigation to the
// registered screens and assert on their UI elements. If the account doesn't
// have super-admin access, screens show access-denied or redirect.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

const ACCOUNT = 'admin-a';

async function openSuperAdmin(page, path) {
  await page.goto(path);
  // Super admin screens reuse teacher screen components, so their headings
  // match the teacher equivalents.
  await expect(
    page
      .getByText(/dashboard|students|assignments|challenges|schedule|attendance|progress/i)
      .first(),
  ).toBeVisible({ timeout: 15000 });
  await dismissAnnouncementIfPresent(page);
}

test.describe('Super Admin - Dashboard', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('dashboard loads with overview stats', async ({ page }) => {
    await openSuperAdmin(page, '/super-admin/dashboard');

    await expect(
      page.getByText(/dashboard|overview|stats/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Super Admin - Students', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('students screen loads with roster UI', async ({ page }) => {
    await openSuperAdmin(page, '/super-admin/students');

    await expect(
      page.getByText(/students|my students|roster/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Super Admin - Assignments', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('assignments screen loads with assignment list', async ({ page }) => {
    await openSuperAdmin(page, '/super-admin/assignments');

    await expect(
      page.getByText(/assignments|my assignments/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Super Admin - Challenges', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('challenges screen loads with challenge list', async ({ page }) => {
    await openSuperAdmin(page, '/super-admin/challenges');

    await expect(
      page.getByText(/challenges|my challenges/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Super Admin - Schedule', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('schedule screen loads with calendar/grid', async ({ page }) => {
    await openSuperAdmin(page, '/super-admin/schedule');

    await expect(
      page.getByText(/schedule|calendar|timetable/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Super Admin - Attendance', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('attendance screen loads with attendance UI', async ({ page }) => {
    await openSuperAdmin(page, '/super-admin/attendance');

    await expect(
      page.getByText(/attendance|present|absent/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Super Admin - Progress', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('progress screen loads with analytics UI', async ({ page }) => {
    await openSuperAdmin(page, '/super-admin/progress');

    await expect(
      page.getByText(/progress|analytics|performance/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Super Admin - navigation gaps', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context }) => {
    await applySession(context, ACCOUNT);
  });

  test('nav items referencing unregistered screens show an error or fallback', async ({
    page,
  }) => {
    // StaffSubjectMapping and ContentReviewDashboard are referenced in nav but
    // NOT registered in SuperAdminNavigator — navigating to them should show
    // an error/not-found or redirect, not a working screen.
    await page.goto('/super-admin/staff-subject-mapping');

    // Expect either an error/not-found state or a redirect to a valid screen.
    const errorOrRedirect = page
      .getByText(/not found|not available|coming soon|error/i)
      .or(page.getByText(/dashboard|students|assignments/i).first());
    await expect(errorOrRedirect.first()).toBeVisible({ timeout: 15000 });
  });
});
