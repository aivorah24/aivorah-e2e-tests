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
// 1. Happy path -> fill every onboarding step -> land on the Dashboard
// 2. Empty required field (name) -> blocked with a validation message

import { test, expect } from '@playwright/test';
import { resetOnboarding } from '../helpers/resetOnboarding.js';

const ONBOARDING_EMAIL = 'e2e.onboarding@aivorah.test';
const ONBOARDING_PASSWORD = 'E2eTest!2026';

// Helper: opens the app and logs in with the onboarding test account.
// Same pattern as b2b-login.spec.js - Login button lives inside an iframe,
// the real login popup opens outside it.
async function loginAsOnboardingStudent(page) {
  await page.goto('/');
  const landingFrame = page.frameLocator('iframe');
  await landingFrame.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'you@example.com' }).fill(ONBOARDING_EMAIL);
  await page.getByRole('textbox', { name: '••••••••' }).fill(ONBOARDING_PASSWORD);
  await page.getByText('Sign In', { exact: true }).click();
}

// Helper: fills every step of the onboarding form and finishes it.
// Each getByText/getByRole call below matches an option we picked while
// recording the flow with Playwright's codegen tool - these are real values
// from the onboarding form, not placeholders.
async function completeOnboardingForm(page) {
  // Step: name
  await page.getByRole('textbox', { name: 'Your name' }).fill('Saimohan');

  // Step: gender
  await page.getByText('Male', { exact: true }).click();

  // Step: date of birth - opens a calendar dialog with 3 pickers in order:
  // click the year in the header to open a year list -> picking a year opens
  // a month list -> picking a month opens the day grid we click into.
  await page.getByText('DD / MM / YYYY').click();
  await page.getByText('2011', { exact: true }).click();
  await page.getByText('2005', { exact: true }).click();
  await page.getByText('Feb', { exact: true }).click();
  await page.getByText('2', { exact: true }).click();

  // Step: curriculum
  await page.getByText('IB PYP', { exact: true }).click();

  // Step: school name (free-text search field)
  const schoolInput = page.getByRole('textbox', { name: 'Type your school name (e.g.' });
  await schoolInput.click();
  await schoolInput.fill('The Shri Ram Academy');

  // Step: location - use device location to auto-fill the city, then pick
  // a state from the dropdown ourselves. We don't hardcode a state name
  // (like "Karnataka") here because real geolocation detects whatever
  // network/location the test is actually running from - it won't be the
  // same every time. Instead we just open the dropdown and pick whichever
  // state appears first, so the test still fills the field either way.
  await page.getByText('Use my location').click();
  await page.getByText('Select your state').click();
  await page.getByText('Andaman and Nicobar Islands').click();

  // Step: grade
  await page.getByText('Grade 3').click();

  // Step: learning style
  await page.getByText('Casual').click();

  // Step: interests
  await page.getByText('Reading', { exact: true }).click();

  // Final step: save everything and go to the Dashboard.
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

    await expect(
      page.getByText(/Good (morning|afternoon|evening),/).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // TEST 2 (validation error) is not written yet - the onboarding form has
  // no "Continue" button like we assumed. It's one page with a single
  // "Complete Setup" button at the bottom, and it looks like that button
  // may just stay disabled until required sections are filled, rather than
  // showing a click-triggered error message. We need to see TEST 1 pass and
  // inspect the real disabled/error behavior before writing this correctly.

});
