# Aivorah E2E Tests — Working Rules

## Branch protection
This is a private repo on GitHub Free — branch protection rule exists but is **not enforced** (GitHub limitation on private repos without a paid plan). Follow it manually:
- Never push directly to `main`
- Always: new branch → write/change → PR → merge
- One branch per test/feature, not one big branch for everything

## PR discipline
- One PR per screen/flow test (small, reviewable)
- Use the PR template checklist every time
- No CI yet — manually run the test locally and confirm it passes before merging

## Test writing rule
Before writing any test, ask Sai what exactly should be tested (happy path, error path, empty state, permission) — confirm, then write.

## Comments rule
Every test file must have simple, beginner-friendly comments explaining what each part does. Sai is learning JS — comments should explain WHY/WHAT in plain language, not assume JS/testing knowledge.

## Explanation rule
Explain in simple, plain language — in chat, not just in code comments. Sai is learning JS.
- Short answers. Get to the point.
- No jargon dumps, no long theory
- Say what broke, why, and what to do next — nothing extra
- If an answer comes out long or full of jargon, redo it shorter and plainer
  instead of defending the long version. Sai will call this out directly when
  it happens — take it as a correction, not a suggestion.

## Daily report format (Sundaresan's rule, 2026-08-06 call)
Each day has two separate things — don't merge them:

1. **Plan** (decided at the start of the day) — 2 parts:
   - Testing part: what's being tested today
   - Refactoring/development part: what's being refactored or built today

2. **Update** (end of day) — 3 parts, always separate, never merged:
   - **Progress** — what you actually did
   - **Result** — did it work, pass or fail, plainly stated (don't fold this
     into Progress — that's how "I refactored X" quietly skips whether X
     still passes)
   - **Effort** — real hours spent, no rounding up or down

Work one feature/module at a time (e.g. "just login today"), not everything
at once — refactor code that's already there rather than rewriting it, and
keep the old code path working until the new one is proven to pass its E2E
test.

## Playwright Test Development Rules
Before creating any new Playwright test file:
1. Never create a file automatically.
2. First analyze the user flow.
3. Suggest:
   - file name
   - folder
   - test grouping
   - tags
4. Wait for my approval.
5. Only after approval:
   - create the file
   - update imports
   - save changes

Never overwrite existing files without confirmation.

Never use Playwright Codegen output directly. Always:
- clean selectors
- remove generated waits
- add assertions
- convert to Page Object Model
- reuse helpers
- make tests deterministic

## After every test
After running/writing a test, Claude should:
- Show (not run) the lint command: `npm run lint`
- Show (not run) the format command: `npm run format`
- Show (not run) the Playwright run command
- Flag any flaky selector spotted, suggest a fix
- Note any failed assertion and whether it's a real bug or a wrong test assumption
- Show (not run) the report command: `npx playwright show-report`
- Update progress.md directly (this is a file edit, not a terminal command, so Claude does this itself)

## Test data state (hard rule)
Three layers, each doing a different job:
1. **Snapshot/restore — the normal case.** `tests/global-setup.js` snapshots every
   `mutable: true` account before the run; `tests/global-teardown.js` writes it back
   after. Fast, automatic, nothing to remember.
2. **Seed script — the crash case.** Snapshot/restore only works if the run FINISHES.
   After any interrupted run (Ctrl+C, crash, machine sleep, dev server died), teardown
   never ran, so the accounts are left dirty — and the next run will snapshot the dirt
   and faithfully restore it. **Re-seed before the next run:**
   `node ai-mentor/server/scripts/seed-e2e-suite.js` (from the Aivorah repo root).
   Also seed before any CI run.
3. **Tests set up their own state.** Don't rely on what the account happened to look
   like. Set the value you're about to assert. Tests that check something is ABSENT are
   the ones that get bitten by leftover data — be extra careful there.

Account ownership lives in `OWNERSHIP` at the bottom of `tests/helpers/accounts.js`.
Accounts are allocated by WHAT IS WRITTEN, not per spec file: read-only specs share
`student-a` and need no account; a spec that saves gets its own; two tests inside one
spec that save the SAME field need one each.

## Coverage checklist
For every feature, consider testing all of these before calling it done:
- Positive test
- Negative test
- Edge cases
- Loading state
- Empty state
- Error state
- Authorization
- Accessibility (basic)

## No unused/unwanted code
Don't generate code, assertions, or steps that aren't actually needed. Understand what the app really does first (check the real screen/flow before writing selectors), then write only what matches it. No guessed steps, no leftover/dead lines in test files.

## Parallel execution (hard rule)
Every test must be able to run in parallel, in any order, on its own.
- No test may depend on another test having run first
- No shared state between tests — each test sets up what it needs and cleans up after itself
- No fixed order assumptions (don't rely on test A creating data that test B reads)
- Each test logs in for itself; don't carry a session across tests
- Avoid tests that mutate shared account data where a parallel test would notice. If a test must change account state (profile photo, display name, settings), use a dedicated account for it, not the shared demo one
- Target: the full E2E suite across all 4 personas (student, teacher, parent, school-admin) finishes in **under 15 minutes**
- Prefer headless; only go headed when a flow genuinely can't run headless, and scope it to that test alone (headed is slower)

## Login: reuse the session, don't re-login (hard rule)
No test drives the login form. Login is a feature we test once, not a setup step for every test.
- Log in ONCE per account in global setup, then inject that session into each test's fresh browser context
- Each test still gets its own clean, isolated context — it just starts already logged in
- The ONLY exception: the login spec itself (`b2b-login.spec.js`), which must log in through the UI to prove login works

This app is Firebase-backed, and its session is NOT captured by Playwright's `storageState` alone. Three pieces are needed:
1. `localStorage` — captured by `storageState`
2. IndexedDB `firebaseLocalStorageDb` → store `firebaseLocalStorage`, key `firebase:authUser:<apiKey>:[DEFAULT]` — must be injected manually
3. `sessionStorage` key `aivorah_auth_this_session` — must be injected manually

Inject 2 and 3 with `context.addInitScript()` before the first `page.goto()`. Verified working.

Why it matters: driving the login form costs ~9s per test (~22 min across ~150 tests) and blows the 15-minute budget on its own. Reused sessions cost ~0.3s.
Firebase tokens expire (~1h), so harvest fresh in global setup, never commit a saved session.

## Scope
E2E suite covers ALL current working functionality across all 4 personas (student, teacher, parent, school-admin) — not just MVP demo flows. Local execution for now, CI/CD added later once suite is stable.
