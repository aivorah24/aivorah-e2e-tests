// Teacher Students status tags (read-only). Guards the manual-test bug where students
// on their first day were tagged "Needs Attention". Rule mirrors
// aivorah-teacher-dashboard-service/utils/studentStatus.js.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { accountFor } from '../../helpers/accounts.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';

export const REQUIRED_ACCOUNTS = ['teacher-a'];

const TEACHER_DASHBOARD_SERVICE_URL = process.env.TEACHER_DASHBOARD_SERVICE_URL || 'http://localhost:3016';
const LABEL = {
  needs_attention: 'Needs Attention', getting_started: 'Getting Started',
  excelling: 'Excelling', on_track: 'On Track', keep_going: 'Keep Going',
};
const DAY_MS = 86400000;

function daysSince(v, now) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : Math.floor((now - t) / DAY_MS);
}

function expectedStatus({ lastActive, createdAt, progressPct }, now = Date.now()) {
  const sinceCreated = daysSince(createdAt, now);
  const sinceSeen = daysSince(lastActive, now) ?? sinceCreated;
  if (sinceSeen != null && sinceSeen >= 7) return 'needs_attention';
  if (sinceCreated == null || sinceCreated < 7) return 'getting_started';
  if ((progressPct ?? 0) >= 50) return 'excelling';
  if ((progressPct ?? 0) >= 20) return 'on_track';
  return 'keep_going';
}

test.describe('Teacher Students - status tags', () => {
  test.use({ storageState: statePath('teacher-a') });

  test.beforeEach(async ({ context }) => { await applySession(context, 'teacher-a'); });

  test('every student has a status that follows the login + progress rule',async ({ request }) => {
    const res = await request.get(`${TEACHER_DASHBOARD_SERVICE_URL}/student/by-teacher/${encodeURIComponent(accountFor('teacher-a').email)}`);
    expect(res.ok()).toBe(true);
    const roster = await res.json();
    expect(roster.length).toBeGreaterThan(0);

    for (const s of roster) {
      expect(s.status, `${s.name}`).toBe(expectedStatus(s));
      expect(s.needsAttention, `${s.name}`).toBe(s.status === 'needs_attention');
    }
  });

  test('each student card shows the badge for its status', async ({ page, request }) => {
    const res = await request.get(`${TEACHER_DASHBOARD_SERVICE_URL}/student/by-teacher/${encodeURIComponent(accountFor('teacher-a').email)}`);
    const roster = await res.json();

    await page.goto('/teacher/students');
    await dismissAnnouncementIfPresent(page);

    for (const s of roster.slice(0, 5)) {
      await expect(page.getByTestId(`teacher-students-status-${s.id}`)).toHaveText(new RegExp(LABEL[s.status]), { timeout: 20000 });
    }
  });
});
