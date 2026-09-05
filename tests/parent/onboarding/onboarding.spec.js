// Feature: PARENT ONBOARDING — the form a brand-new parent fills in right
// after signing up (OnboardingParentBoxes.tsx, reached via App.tsx ->
// OnboardingScreen -> role === 'parent'), before they can reach the Parent
// Dashboard. This is a DIFFERENT journey from
// tests/teacher/switch-profile/switch-profile.spec.js, which drives the
// same underlying component but from a teacher account adding a SECOND
// role - that spec's account/journey must never be reused here.
//
// This file is the approved MVP acceptance contract FB1-FB6 (see project
// discussion) - six independent, business-readable scenarios, each mapped
// 1:1 to its own test below.
//
// ── Parallel-safety design (HARD REQUIREMENT) ──────────────────────────
// Every scenario gets its OWN dedicated account (parent-onboard-1..6, plus
// student-onboard-linktarget for FB5) - see tests/helpers/accounts.js.
// Exactly the student-d1..d10 pattern (see tests/student/onboarding.spec.js's
// header): running 6+ tests in parallel against a SHARED account would let
// one test's reset/submit stomp a concurrent test's in-progress form.
//
// There is deliberately NO shared beforeEach here. Each test calls its own
// resetFor(...)/cleanup at the top/bottom of its OWN body - a shared
// beforeEach can't know which account belongs to which test when Playwright
// runs them in parallel, arbitrary order, or retries one in isolation.
// Every test is fully self-contained: establishes its own session, resets
// its own DB state, creates only its own data (uniquely named/scoped), and
// cleans up only what it created - safe to run with --workers=6, safe to
// retry, safe in any order.

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { resetOnboarding } from '../../helpers/resetOnboarding.js';
import { deleteCreatedChildrenByNamePrefix } from '../../helpers/deleteCreatedChild.js';
import { deleteParentChildLink } from '../../helpers/deleteParentChildLink.js';
import { readOtp, deleteOtp } from '../../helpers/readOtp.js';
import { accountFor } from '../../helpers/accounts.js';
import { newPageAs } from '../../helpers/session.js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUserRow(email) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('role, onboarding_complete')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new Error(`Failed to read users row for ${email}: ${error.message}`);
  return data;
}

async function getLinkedChild(parentEmail, namePrefix) {
  const { data, error } = await supabaseAdmin
    .from('parent_children')
    .select('users:child_id(id, name, email)')
    .eq('parent_email', parentEmail);
  if (error) throw new Error(`Failed to read parent_children for ${parentEmail}: ${error.message}`);
  return (data || []).map((r) => r.users).find((u) => u?.name?.startsWith(namePrefix));
}

async function isLinked(parentEmail, childEmail) {
  const { data: child } = await supabaseAdmin.from('users').select('id').eq('email', childEmail).maybeSingle();
  if (!child) return false;
  const { data } = await supabaseAdmin
    .from('parent_children')
    .select('child_id')
    .eq('parent_email', parentEmail)
    .eq('child_id', child.id)
    .maybeSingle();
  return !!data;
}

async function openAsOnboardingParent(browser, accountKey) {
  const page = await newPageAs(browser, accountKey);
  await page.goto('/');
  return page;
}

// ── Shared form-filling steps (plain UI interactions, no implementation
// internals - same widgets/text every real parent sees) ───────────────────
async function fillPersonalInfo(page) {
  await page.getByPlaceholder('Your name').fill('E2E Onboarding Parent');
  await page.getByText('Select your state').click();
  await page.getByPlaceholder('Search state...').fill('Telangana');
  await page.getByText('Telangana', { exact: true }).last().click();
  await page.getByText('Select your city').click();
  await page.getByText('Hyderabad', { exact: true }).last().click();
  await page.getByText('DD / MM / YYYY').click();
  await page.getByText('2011', { exact: true }).click();
  await page.getByText('2005', { exact: true }).click();
  await page.getByText('Jan', { exact: true }).click();
  await page.getByText('10', { exact: true }).first().click();
  await page.getByPlaceholder('98765 43210').fill('9876543210');
}

async function fillChildBasics(page, { name, age }) {
  await page.getByPlaceholder("Enter your child's name").fill(name);
  await page.getByPlaceholder('e.g. 9').fill(age);
}

async function fillChildLearningProfile(page, { curriculum, grade }) {
  await page.getByText(curriculum, { exact: true }).click();
  await page.getByText(grade, { exact: true }).click();
}

test.describe('Parent Onboarding', () => {
  // ── FB1: Parent completes onboarding with no children ──────────────────
  test('parent with no children completes onboarding from personal info alone', async ({ browser }) => {
    const account = accountFor('parent-onboard-1');
    await resetOnboarding(account.email);

    const page = await openAsOnboardingParent(browser, 'parent-onboard-1');
    await fillPersonalInfo(page);
    await page.getByText('Skip for now & Finish', { exact: true }).click();

    await expect(page.getByText('My Children', { exact: true })).toBeVisible({ timeout: 15000 });

    const row = await getUserRow(account.email);
    expect(row.role).toBe('parent');
    expect(row.onboarding_complete).toBe(true);
  });

  // ── FB2: Parent cannot finish without a name ────────────────────────────
  test('parent cannot finish onboarding without a name', async ({ browser }) => {
    const account = accountFor('parent-onboard-2');
    await resetOnboarding(account.email);

    const page = await openAsOnboardingParent(browser, 'parent-onboard-2');
    // Everything except the name (fillPersonalInfo always sets it, so fill
    // the remaining fields directly instead of skipping inside the helper -
    // keeps this test's intent explicit: name is the one thing missing).
    await page.getByText('Select your state').click();
    await page.getByPlaceholder('Search state...').fill('Telangana');
    await page.getByText('Telangana', { exact: true }).last().click();
    await page.getByText('Select your city').click();
    await page.getByText('Hyderabad', { exact: true }).last().click();
    await page.getByText('DD / MM / YYYY').click();
    await page.getByText('2011', { exact: true }).click();
    await page.getByText('2005', { exact: true }).click();
    await page.getByText('Jan', { exact: true }).click();
    await page.getByText('10', { exact: true }).first().click();
    await page.getByPlaceholder('98765 43210').fill('9876543210');

    const finishBtn = page.getByText('Skip for now & Finish', { exact: true });
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();

    // Still on the onboarding screen - no navigation happened.
    await expect(page.getByText('Still needed', { exact: false })).toBeVisible();
    await expect(page.getByText('My Children', { exact: true })).not.toBeVisible();

    const row = await getUserRow(account.email);
    expect(row.onboarding_complete).toBe(false);
  });

  // ── FB3: Under-14 child gets a real, usable account ─────────────────────
  test('parent onboarding a child under 14 gets that child a new login, visible in their dashboard', async ({ browser }) => {
    const account = accountFor('parent-onboard-3');
    await resetOnboarding(account.email);
    const CHILD_NAME_PREFIX = 'E2E FB3 Child';
    const childName = `${CHILD_NAME_PREFIX} ${Date.now()}`;

    try {
      const page = await openAsOnboardingParent(browser, 'parent-onboard-3');
      await fillPersonalInfo(page);
      await fillChildBasics(page, { name: childName, age: '9' });
      await page.getByPlaceholder('e.g. Hyderabad International School').fill('E2E Test School');
      await fillChildLearningProfile(page, { curriculum: 'IB PYP', grade: 'Grade 3' });

      await page.getByText('Complete Setup', { exact: true }).click();
      await expect(page.getByText('Child Account Created', { exact: true })).toBeVisible({ timeout: 15000 });
      await page.getByText("Got it, I've saved these", { exact: true }).click();

      await expect(page.getByText('My Children', { exact: true })).toBeVisible({ timeout: 15000 });

      const child = await getLinkedChild(account.email, CHILD_NAME_PREFIX);
      expect(child, 'child should be linked to this parent in parent_children').toBeTruthy();
      expect(child.email).toBeTruthy();
    } finally {
      await deleteCreatedChildrenByNamePrefix(account.email, CHILD_NAME_PREFIX);
      await resetOnboarding(account.email);
    }
  });

  // ── FB4: Incomplete started child blocks finishing ──────────────────────
  test('parent cannot finish onboarding while a started child is incomplete', async ({ browser }) => {
    const account = accountFor('parent-onboard-4');
    await resetOnboarding(account.email);

    const page = await openAsOnboardingParent(browser, 'parent-onboard-4');
    await fillPersonalInfo(page);
    // Only the child's name - nothing else. Starting a child (per the
    // product's own optional-children rule) switches the button to
    // "Complete Setup" but it must stay blocked until finished or removed.
    await page.getByPlaceholder("Enter your child's name").fill('E2E FB4 Started Child');

    const completeBtn = page.getByText('Complete Setup', { exact: true });
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    await expect(page.getByText('Still needed', { exact: false })).toBeVisible();
    await expect(page.getByText('My Children', { exact: true })).not.toBeVisible();

    const row = await getUserRow(account.email);
    expect(row.onboarding_complete).toBe(false);
    // No cleanup needed - handleFinish never ran, nothing was persisted.
  });

  // ── FB5: Teen's existing account is linked, not duplicated ──────────────
  test('parent onboarding a teenager links their existing account instead of creating one', async ({ browser }) => {
    const account = accountFor('parent-onboard-5');
    const linkTarget = accountFor('student-onboard-linktarget');
    await resetOnboarding(account.email);

    try {
      const page = await openAsOnboardingParent(browser, 'parent-onboard-5');
      await fillPersonalInfo(page);
      await fillChildBasics(page, { name: 'E2E FB5 Teen', age: '15' });
      // Learning Profile is required for every started child regardless of
      // age branch (curriculumDone applies to all `startedChildren`) - only
      // section 4 (Account) differs between the under-14/14+ paths.
      await fillChildLearningProfile(page, { curriculum: 'IB MYP', grade: 'Grade 9' });
      await page.getByPlaceholder('child@email.com').first().fill(linkTarget.email);

      await page.getByText('Complete Setup', { exact: true }).click();
      // Linking an existing account has no "credentials created" modal
      // (nothing new is created) - it goes straight to the Dashboard.
      await expect(page.getByText('My Children', { exact: true })).toBeVisible({ timeout: 15000 });

      const linked = await isLinked(account.email, linkTarget.email);
      expect(linked, 'parent-onboard-5 should now be linked to student-onboard-linktarget').toBe(true);
    } finally {
      // Scoped to exactly this pair (see deleteParentChildLink.js) - can
      // never affect any other parent/child relationship.
      await deleteParentChildLink(account.email, linkTarget.email);
      await resetOnboarding(account.email);
    }
  });

  // ── FB6: Child email verification reflected on the account ─────────────
  test('parent verifies a real email entered for their child during onboarding', async ({ browser }) => {
    const account = accountFor('parent-onboard-6');
    await resetOnboarding(account.email);
    const CHILD_NAME_PREFIX = 'E2E FB6 Child';
    const childName = `${CHILD_NAME_PREFIX} ${Date.now()}`;
    // Unique per run so a parallel/retried run's OTP row can never collide
    // with this one - readOtp/deleteOtp are scoped to this exact email.
    const childEmail = `e2e.fb6.child.${Date.now()}@aivorah.test`;

    try {
      const page = await openAsOnboardingParent(browser, 'parent-onboard-6');
      await fillPersonalInfo(page);
      await fillChildBasics(page, { name: childName, age: '8' });
      await page.getByPlaceholder('e.g. Hyderabad International School').fill('E2E Test School');
      await fillChildLearningProfile(page, { curriculum: 'IB PYP', grade: 'Grade 2' });

      await page.getByPlaceholder('child@email.com').first().fill(childEmail);
      await page.getByText('Send Code', { exact: true }).click();
      // The click resolves as soon as the event fires, not when the
      // underlying fetch completes - wait for the button's own "sent"
      // state (switches to a cooldown/Resend label) before reading the
      // OTP, otherwise this can race the write.
      await expect(page.getByText(/Resend/, { exact: false })).toBeVisible({ timeout: 10000 });

      const otp = await readOtp(childEmail);
      await page.getByPlaceholder('Enter 6-digit code').fill(otp);
      await page.getByText('Verify', { exact: true }).click();
      await expect(page.getByText('Verified', { exact: true }).first()).toBeVisible({ timeout: 10000 });

      await page.getByText('Complete Setup', { exact: true }).click();
      await expect(page.getByText('Child Account Created', { exact: true })).toBeVisible({ timeout: 15000 });
      await page.getByText("Got it, I've saved these", { exact: true }).click();
      await expect(page.getByText('My Children', { exact: true })).toBeVisible({ timeout: 15000 });

      const child = await getLinkedChild(account.email, CHILD_NAME_PREFIX);
      expect(child, 'verified child should be linked to this parent').toBeTruthy();
      expect(child.email?.toLowerCase()).toBe(childEmail.toLowerCase());
    } finally {
      await deleteCreatedChildrenByNamePrefix(account.email, CHILD_NAME_PREFIX);
      await deleteOtp(childEmail);
      await resetOnboarding(account.email);
    }
  });
});
