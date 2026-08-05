// This file tests the STUDENT ONBOARDING flow: the setup screens a student
// fills in AFTER logging in for the first time (name, gender, date of birth,
// curriculum, school, location, grade, learning style, interests) before they
// can reach the Dashboard.
//
// Test account used (fixed, reusable):
//   Email:    e2e.onboarding@aivorah.test
//   Password: E2eTest!2026
// This account's email is already verified. BEFORE EACH TEST BELOW, we reset
// this account's onboarding_completed flag back to false directly in the
// database (see tests/helpers/resetOnboarding.js) - this guarantees every
// test starts from the exact same "onboarding not done yet" state, instead
// of depending on what a previous test run left behind.
//
// We test:
// 1. Happy path -> fill every required field -> land on the Dashboard
// 2. Each required field left empty, one at a time -> should NOT reach
//    the Dashboard (Complete Setup stays blocked)
// 3. A known bug: the form lets you pick a Grade and a Date of Birth that
//    don't match (e.g. Grade 3 with a DOB that makes the student 15) -
//    it should warn/block this but currently doesn't. We keep this test
//    even though it fails, to document the gap until it's fixed.
//
// NOTE: "Use my location" is not tested here - see git history/PR for why.

import { test, expect } from '@playwright/test';
import { resetOnboarding } from '../helpers/resetOnboarding.js';

const ONBOARDING_EMAIL = 'e2e.onboarding@aivorah.test';
const ONBOARDING_PASSWORD = 'E2eTest!2026';

// Helper: opens the app and logs in with the onboarding test account.
async function loginAsOnboardingStudent(page) {
  await page.goto('/');
  const landingFrame = page.frameLocator('iframe');
  await landingFrame.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'you@example.com' }).fill(ONBOARDING_EMAIL);
  await page.getByRole('textbox', { name: '••••••••' }).fill(ONBOARDING_PASSWORD);
  await page.getByText('Sign In', { exact: true }).click();
}

// Each of these fills in ONE section of the onboarding form. Splitting them
// up (instead of one big function) lets each test skip exactly one step,
// to check that missing field actually blocks Complete Setup.
async function fillName(page) {
  await page.getByRole('textbox', { name: 'Your name' }).fill('Saimohan');
}

async function fillGender(page) {
  await page.getByText('Male', { exact: true }).click();
}

// Opens a calendar dialog with 3 pickers in order: click the year in the
// header to open a year list -> picking a year opens a month list ->
// picking a month opens the day grid we click into.
async function fillDateOfBirth(page) {
  await page.getByText('DD / MM / YYYY').click();
  await page.getByText('2011', { exact: true }).click();
  await page.getByText('2005', { exact: true }).click();
  await page.getByText('Feb', { exact: true }).click();
  await page.getByText('2', { exact: true }).click();
}

async function fillCurriculum(page) {
  await page.getByText('IB PYP', { exact: true }).click();
}

async function fillSchoolName(page) {
  const schoolInput = page.getByRole('textbox', { name: 'Type your school name (e.g.' });
  await schoolInput.click();
  await schoolInput.fill('The Shri Ram Academy');
}

// City only becomes pickable once a state is chosen, so this fills both.
async function fillStateAndCity(page) {
  await page.getByText('Select your state').click();
  await page.getByPlaceholder('Search state...').fill('Telangana');
  await page.getByText('Telangana', { exact: true }).click();
  await page.getByText('Select your city').click();
  await page.getByText('Hyderabad', { exact: true }).click();
}

async function fillGrade(page) {
  await page.getByText('Grade 3').click();
}

async function fillLearningStyle(page) {
  await page.getByText('Casual').click();
}

async function fillInterests(page) {
  await page.getByText('Reading', { exact: true }).click();
}

// Fills every step of the onboarding form and clicks Complete Setup.
// Pass a field name in `skip` to leave that one step out (used by the
// empty-field tests below).
async function completeOnboardingForm(page, { skip } = {}) {
  if (skip !== 'name') await fillName(page);
  if (skip !== 'gender') await fillGender(page);
  if (skip !== 'dob') await fillDateOfBirth(page);
  if (skip !== 'curriculum') await fillCurriculum(page);
  if (skip !== 'school') await fillSchoolName(page);
  if (skip !== 'location') await fillStateAndCity(page);
  if (skip !== 'grade') await fillGrade(page);
  if (skip !== 'learningStyle') await fillLearningStyle(page);
  if (skip !== 'interests') await fillInterests(page);

  // This form is a single page (not a step wizard) - "Complete Setup" is
  // the one button at the bottom that submits everything at once.
  await page.getByText('Complete Setup').click();
}

test.describe('Student Onboarding', () => {
  // This runs before EVERY test below - it resets our test account's
  // onboarding status in the database so each test starts fresh, the same
  // way every time, no matter what an earlier test run did to this account.
  test.beforeEach(async () => {
    await resetOnboarding(ONBOARDING_EMAIL);
  });

  // TEST 1: filling every step correctly should land the student on the Dashboard
  test('completing onboarding reaches the dashboard', async ({ page }) => {
    await loginAsOnboardingStudent(page);
    await completeOnboardingForm(page);

    await expect(page.getByText(/Good (morning|afternoon|evening),/).first()).toBeVisible({
      timeout: 10000,
    });
  });

  // TESTS 2a-2h: leaving ONE required field empty should NOT let the
  // student reach the Dashboard - Complete Setup should stay blocked.
  const requiredFields = ['name', 'gender', 'dob', 'curriculum', 'school', 'location', 'grade'];

  for (const field of requiredFields) {
    test(`leaving ${field} empty blocks onboarding`, async ({ page }) => {
      await loginAsOnboardingStudent(page);
      await completeOnboardingForm(page, { skip: field });

      // Should NOT reach the Dashboard - still stuck on the onboarding page.
      await expect(page.getByText(/Good (morning|afternoon|evening),/).first()).not.toBeVisible({
        timeout: 5000,
      });
    });
  }

  // TEST 3 (KNOWN BUG): the app should not let you pick a Grade and Date of
  // Birth that don't realistically match (e.g. Grade 3 with a DOB that
  // makes the student 15 years old), but today it lets you through anyway.
  // This test is written for the CORRECT/expected behavior, so it will show
  // up RED/failing in results until the app actually adds this validation -
  // that's intentional, it's how we track the bug is still unfixed.
  test('grade and date of birth mismatch should be blocked (known bug - not implemented yet)', async ({
    page,
  }) => {
    await loginAsOnboardingStudent(page);
    await completeOnboardingForm(page); // DOB = 2 Feb 2005, Grade = Grade 3 (mismatched on purpose)

    await expect(
      page.getByText(/does not match|doesn't match|check the date of birth/i),
    ).toBeVisible({ timeout: 5000 });
  });
});
