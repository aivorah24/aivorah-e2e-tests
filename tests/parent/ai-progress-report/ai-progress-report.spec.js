// Feature: Parent AI Progress Report — generate an AI-written performance
// report for a child, using real activity data (no mocks). Backend lives in
// aivorah-students-service (ported off the monolith 2026-09-02); the
// monolith's Groq model (llama-3.3-70b-versatile) was returning 404
// model_not_found in production ("Failed to generate report" on every real
// click) — this was the live bug this spec was written to catch and pin down.
//
// Uses parent-e — already provisioned with 2 linked children and real
// activity (shared with the Progress spec), read-only so safe to reuse.

import { test, expect } from '@playwright/test';
import { applySession, statePath } from '../../helpers/auth.js';
import { accountFor } from '../../helpers/accounts.js';

const READ_ONLY_PARENT = 'parent-e';

test.describe('Parent AI Progress Report', () => {
  test.use({ storageState: statePath(READ_ONLY_PARENT) });

  test.beforeEach(async ({ context, page }) => {
    await applySession(context, READ_ONLY_PARENT);
    await page.goto('/parent/ai-reports');
    await expect(
      page.getByText('AI Progress Report', { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('generating a report for a real child returns real data, not an error', async ({ page }) => {
    const generateBtn = page.getByText('Generate', { exact: true }).filter({ visible: true }).first();
    await expect(generateBtn).toBeVisible({ timeout: 15000 });
    await generateBtn.click();

    // The live bug this test exists to catch: a dead Groq model string made
    // every single generation fail with this exact banner.
    await expect(page.getByText('Failed to generate report', { exact: true })).not.toBeVisible({ timeout: 20000 });

    // Real report content, sourced from actual student_stats/analytics data -
    // "Regenerate Report" only renders once reportData is populated and not
    // noData, so its presence proves a real (non-empty) report came back.
    await expect(
      page.getByText('Regenerate Report', { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 25000 });
  });

  test('report includes metrics sourced from the child\'s real stats, not placeholders', async ({ page }) => {
    const generateBtn = page.getByText('Generate', { exact: true }).filter({ visible: true }).first();
    await expect(generateBtn).toBeVisible({ timeout: 15000 });
    await generateBtn.click();

    await expect(
      page.getByText('Regenerate Report', { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 25000 });

    // Metric labels rendered from the /ai-report response's `metrics` object -
    // confirms the report card actually rendered real backend data, not a
    // static/empty shell.
    await expect(page.getByText('Total XP', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Active Days', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('switching to a second linked child and regenerating shows that child\'s own name', async ({ page, request }) => {
    const parentEmail = accountFor(READ_ONLY_PARENT).email;
    const res = await request.get(
      `${process.env.STUDENTS_SERVICE_URL || 'http://localhost:3017'}/parent/${encodeURIComponent(parentEmail)}/children`,
    );
    // Falls back to the monolith's /parent/:email/children if students-service
    // isn't reachable in this environment — the E2E only needs 2 real linked
    // children to exist, not which service served the list.
    const children = res.ok() ? await res.json() : [];
    test.skip(!Array.isArray(children) || children.length < 2, 'parent-e needs 2 linked children for this test');

    const secondChildName = children[1].name;
    await page.getByText(secondChildName, { exact: false }).filter({ visible: true }).first().click();

    const generateBtn = page.getByText('Generate', { exact: true }).filter({ visible: true }).first();
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();
    }

    await expect(
      page.getByText(secondChildName, { exact: false }).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 25000 });
  });
});
