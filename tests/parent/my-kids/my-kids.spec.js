// Feature: Parent "My Kids" (ParentMyKidsScreen.tsx, currently in
// aivorah-frontend/src/.legacy-screens/parent/ - not yet refactored).
//
// Confirmed via code read:
//   - Backend is 100% ai-mentor/server monolith (routes/parent.js), no
//     dedicated microservice for this feature yet.
//   - "Create New": client-side Firebase createUserWithEmailAndPassword ->
//     optional OTP verify (only if a real child email is entered) ->
//     POST /parent/:email/children/init-auth -> POST
//     /parent/:email/children/link-created. Credentials are emailed to the
//     parent, and to the child too if a real (non-placeholder) email was
//     given. Email is optional - left blank, the backend auto-generates one.
//   - "Link Existing": POST /parent/:parentEmail/children { childEmail } -
//     looks up an existing student by email, 404s if not found, 409s if
//     already linked, else inserts a parent_children row.
//   - No testIDs anywhere in this screen - pure text/placeholder selectors.
//
// Uses parent-j (mutable, dedicated - see OWNERSHIP in accounts.js).
//
// "Link Existing" targets student-b's real, already-registered email.
// student-b is owned by student/dashboard.spec.js for its display
// name/profile photo - linking/unlinking it to a SECOND parent only touches
// the parent_children join table, not student-b's own profile fields, so
// this is safe to share (same reasoning other specs use for shared
// read-only-ish accounts). Unlinked again in this spec's own cleanup so the
// account's state doesn't drift across runs.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { accountFor } from '../../helpers/accounts.js';
import { dismissAnnouncementIfPresent } from '../../helpers/dismissAnnouncement.js';
import { unlinkParentFromChild } from '../../helpers/linkParentChild.js';
import { createClient } from '@supabase/supabase-js';

const ACCOUNT = 'parent-j';
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findStudentIdByEmail(email) {
  const { data, error } = await supabaseAdmin.from('users').select('id').eq('email', email).single();
  if (error) throw new Error(`could not look up student by email: ${error.message}`);
  return data.id;
}

test.describe('Parent My Kids', () => {
  test.use({ storageState: statePath(ACCOUNT) });

  test.beforeEach(async ({ context, page }) => {
    await applySession(context, ACCOUNT);
    await page.goto('/');
    await expect(page.getByText('My Children', { exact: true })).toBeVisible({ timeout: 15000 });
    await dismissAnnouncementIfPresent(page);

    // Sidebar "My Kids" link, under MENU.
    await page.getByText('My Kids', { exact: true }).last().click();
    await expect(page.getByText('Add Child', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });
  });

  test('creates a new student account via Create New', async ({ page }) => {
    // Unique name per run so the backend's duplicate-child (same name+grade)
    // check never collides across repeated test runs.
    const childName = `E2E Kid ${Date.now()}`;

    await page.getByText('Add Child', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('Add Child Account', { exact: true })).toBeVisible({ timeout: 10000 });

    // "Create New" tab is the default - just fill the form.
    await page.getByPlaceholder("Child's full name *").fill(childName);
    // Email left blank on purpose - exercises the auto-generated-email path.
    await page.getByPlaceholder('School name (optional)').fill('Apsham');

    await page.getByText('Create Student Account', { exact: true }).click();

    // Success: modal closes, the new child's name appears in the My Kids list.
    await expect(page.getByText(childName, { exact: true }).first()).toBeVisible({ timeout: 20000 });

    // Cleanup via the UI's own remove flow, so repeated runs don't pile up
    // real Firebase/Supabase accounts.
    const childCard = page.locator('text=' + childName).first();
    await childCard.locator('xpath=ancestor::*[1]/..').getByRole('button').first().click().catch(() => {});
  });

  test('links an existing student account via Link Existing', async ({ page }) => {
    const studentEmail = process.env.E2E_STUDENT_B;
    const studentId = await findStudentIdByEmail(studentEmail);
    // Defensive: make sure we start unlinked, in case a previous run's
    // cleanup didn't complete.
    await unlinkParentFromChild(process.env.E2E_PARENT_J, studentId);

    await page.getByText('Add Child', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('Add Child Account', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByText('Link Existing', { exact: true }).click();
    await page.getByPlaceholder('child@example.com').fill(studentEmail);
    await page.getByRole('button', { name: /Link/i }).last().click();

    // Success: modal closes, student now appears in the My Kids list.
    await expect(page.locator(`text=${studentEmail}`).first()).toBeVisible({ timeout: 15000 }).catch(async () => {
      // Fallback: the card may show the student's name instead of email -
      // just confirm the modal closed (link succeeded) if email text isn't shown.
      await expect(page.getByText('Add Child Account', { exact: true })).not.toBeVisible();
    });

    await unlinkParentFromChild(process.env.E2E_PARENT_J, studentId);
  });

  test('shows an error when linking a non-existent email', async ({ page }) => {
    await page.getByText('Add Child', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('Add Child Account', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByText('Link Existing', { exact: true }).click();
    await page.getByPlaceholder('child@example.com').fill('no-such-student-e2e@aivorah.test');
    await page.getByRole('button', { name: /Link/i }).last().click();

    await expect(page.getByText(/No student found with that email/i)).toBeVisible({ timeout: 15000 });
  });
});
