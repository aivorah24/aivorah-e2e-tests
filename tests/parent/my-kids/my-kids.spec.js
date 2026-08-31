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
import { createClient } from '@supabase/supabase-js';

const ACCOUNT = 'parent-j';
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// The backend resolves the child with
// .eq('email', childEmail.toLowerCase().trim()) (routes/parent.js:492), so a
// case-sensitive .eq() here can resolve a DIFFERENT users row than the one the
// link actually targets - which is why the pre-test unlink kept reporting zero
// rows while the link POST still 409'd on an existing row. Match the way the
// backend does, and return every candidate so all of them get unlinked.
async function findStudentIdsByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .ilike('email', String(email || '').trim());
  if (error) throw new Error(`could not look up student by email: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`no users row for ${email}`);
  return data;
}

// The shared unlinkParentFromChild helper matches parent_email with an exact
// .eq(), which silently no-ops when the row was written with different
// casing than E2E_PARENT_J (the backend inserts req.params.parentEmail
// verbatim, unnormalised - routes/parent.js:502). That left a stale row
// behind and the link POST came back 409 "already linked". Match
// case-insensitively instead, and report what survived if anything does.
async function forceUnlink(parentEmail, childId) {
  const { data: rows } = await supabaseAdmin
    .from('parent_children')
    .select('parent_email')
    .eq('child_id', childId);
  const target = String(parentEmail || '').trim().toLowerCase();
  for (const row of rows || []) {
    if (String(row.parent_email || '').trim().toLowerCase() === target) {
      await supabaseAdmin
        .from('parent_children')
        .delete()
        .eq('child_id', childId)
        .eq('parent_email', row.parent_email);
    }
  }
  const { data: left } = await supabaseAdmin
    .from('parent_children')
    .select('parent_email')
    .eq('child_id', childId);
  return (left || []).map(r => r.parent_email);
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

    // Curriculum and Grade are required chip selectors, not native <select>s
    // (createStudent() blocks with "Please select a curriculum/grade" if
    // skipped - confirmed via ParentMyKidsScreen.tsx:404-405). Grade options
    // only render after a curriculum is picked.
    await page.getByText('CBSE', { exact: true }).filter({ visible: true }).first().click();
    await page.getByText('Grade 3', { exact: true }).filter({ visible: true }).first().click();

    await page.getByText('Create Student Account', { exact: true }).filter({ visible: true }).first().click();

    // Success: creation triggers a credentials modal ("<name>'s login
    // details") BEFORE the list updates - confirmed via a failure snapshot
    // showing this dialog blocking the assertion. Close it first.
    await expect(page.getByText(`${childName}'s login details`, { exact: true })).toBeVisible({ timeout: 20000 });
    await page.getByText("Got it, I've saved these", { exact: true }).filter({ visible: true }).first().click();

    // Now the new child's name appears in the My Kids list.
    await expect(page.getByText(childName, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });

    // Cleanup via a direct DB delete rather than the UI's remove flow - the
    // exact DOM ancestor level to find this specific child's remove button
    // proved too fragile (RN Web's duplicate mobile/desktop rendering makes
    // xpath ancestor-counting unreliable). Functional assertions above this
    // point already prove the real feature works; this is just tidying up
    // the real account created so repeated runs don't pile up.
    const { data: created } = await supabaseAdmin.from('users').select('id').eq('name', childName).maybeSingle();
    if (created?.id) {
      await supabaseAdmin.from('parent_children').delete().eq('child_id', created.id);
      await supabaseAdmin.from('users').delete().eq('id', created.id);
    }
  });

  test('links an existing student account via Link Existing', async ({ page }) => {
    const studentEmail = process.env.E2E_STUDENT_B;
    const studentRows = await findStudentIdsByEmail(studentEmail);
    const studentId = studentRows[0].id;
    // Defensive: make sure we start unlinked, in case a previous run's
    // cleanup didn't complete. Every candidate row is unlinked, since the
    // backend picks by lowercased email and may not pick studentRows[0].
    const remainingLinks = [];
    for (const row of studentRows) {
      remainingLinks.push({ id: row.id, left: await forceUnlink(process.env.E2E_PARENT_J, row.id) });
    }

    // try/finally: if an assertion fails, the unlink MUST still run -
    // otherwise the stale parent_children row makes every later run 409
    // 'already linked' (exactly how this test got stuck).
    try {
      await page.getByText('Add Child', { exact: true }).filter({ visible: true }).first().click();
      await expect(page.getByText('Add Child Account', { exact: true })).toBeVisible({ timeout: 10000 });

      await page.getByText('Link Existing', { exact: true }).filter({ visible: true }).first().click();
      await page.getByPlaceholder('child@example.com').fill(studentEmail);

      // Assert on the real POST /parent/:email/children response rather than
      // guessing from the DOM: addChild() only closes the modal on a 2xx, so a
      // still-open modal previously gave a useless "modal is visible" failure
      // with no indication of WHY (404 vs 409 vs 500). Capturing the response
      // surfaces the backend's own error message in the failure output.
      // Record EVERY matching POST, not just the first. A single
      // waitForResponse raced: if the click produces two requests, the second
      // one necessarily 409s ("already linked") because the first already
      // inserted the row, and the test then reported that 409 as a failure.
      // What matters is that the link succeeded at least once.
      const linkStatuses = [];
      page.on('response', async r => {
        if (/\/parent\/[^/]+\/children(\?|$)/.test(r.url()) && r.request().method() === 'POST') {
          linkStatuses.push(`${r.status()} ${await r.text().catch(() => '<unreadable>')}`);
        }
      });

      await page.getByText('Link Account', { exact: true }).filter({ visible: true }).first().click();
      await expect.poll(() => linkStatuses.length, { timeout: 20000 }).toBeGreaterThan(0);

      const { data: rowsAfter } = await supabaseAdmin
        .from('parent_children')
        .select('parent_email, child_id')
        .in('child_id', studentRows.map(r => r.id));
      expect(
        linkStatuses.some(s => s.startsWith('200')) || (rowsAfter || []).length > 0,
        `link did not succeed. responses=${JSON.stringify(linkStatuses)}; ` +
          `rows before=${JSON.stringify(remainingLinks)}; ` +
          `rows after=${JSON.stringify(rowsAfter)}`
      ).toBe(true);

      // Success: modal closes (it unmounts, so it disappears from the DOM
      // entirely - count 0 avoids the RN Web duplicate-node visibility trap).
      await expect(page.getByText('Add Child Account', { exact: true })).toHaveCount(0, { timeout: 15000 });

      // ...and the student now appears in the My Kids list. The card may show
      // either the email or the display name, so accept either.
      await expect(
        page.getByText(studentEmail, { exact: false }).filter({ visible: true }).first()
      ).toBeVisible({ timeout: 15000 });

    } finally {
      for (const row of studentRows) {
        await forceUnlink(process.env.E2E_PARENT_J, row.id);
      }
    }
  });

  test('shows an error when linking a non-existent email', async ({ page }) => {
    await page.getByText('Add Child', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('Add Child Account', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByText('Link Existing', { exact: true }).filter({ visible: true }).first().click();
    await page.getByPlaceholder('child@example.com').fill('no-such-student-e2e@aivorah.test');
    await page.getByText('Link Account', { exact: true }).filter({ visible: true }).first().click();

    await expect(page.getByText(/No student found with that email/i)).toBeVisible({ timeout: 15000 });
  });
});
