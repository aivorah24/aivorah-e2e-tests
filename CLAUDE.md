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

## E2E Persona Rule (non-negotiable)

The persona under test MUST perform its actual user journey through the browser/UI — clicking, navigating, viewing rendered data. Never replace a tested persona's own actions with a direct API call.

**API calls are allowed ONLY for:**
- Preparing test data / creating deterministic state (including mutating a *different* persona's state that the current persona's journey depends on — e.g. a student completing an assignment so a teacher can see it)
- Read-only lookups used solely to compute an expected UI value to compare against (e.g. reading a shared read-only account's real stats before checking the screen shows them correctly) — comment these as "read-only expected-value lookup", not "test-data setup"

**Not allowed:**
- Using an API response as the test's actual assertion (`expect(apiResponse.count).toBe(5)`) — even as a mid-test synchronization/"did the backend commit" guard. If the backend didn't commit, the UI simply won't show the expected value and the UI-side assertion will fail with that signal instead.
- Calling the tested persona's own dashboard/data API directly and asserting on it, in place of loading the real screen and checking what's rendered.

**Pattern:**
```
API:    prepare/mutate state (setup only)
         ↓
Browser: login as the persona → navigate → click → view
         ↓
UI:      assert the rendered result
```

Every test's *final* assertion must be a UI check (`page.getByText(...)`, `toBeVisible()`, etc.), never an API response.

## Default commands

Run the AI Coach suite (functional + a11y) with video recorded to `recordings/`
(video is always on, per `playwright.config.js`'s `use.video: 'on'`):

```bash
npx playwright test tests/student/ai-coach --project=chromium --reporter=line
```

Mic tests run separately (need real Chrome, not bundled Chromium - see
`playwright.config.js`'s `chromium-mic` project):

```bash
npx playwright test tests/student/ai-coach/ai-coach-mic.spec.js --project=chromium-mic --reporter=line
```

Videos land in `recordings/<test-name>/video.webm` (gitignored - clear the
folder anytime with `rm -rf recordings/*`).

## Parallel execution rule (non-negotiable)

Every test must be able to run in parallel with the rest of the suite — no `test.describe.configure({ mode: 'serial' })`, no relying on test order.

If two tests would otherwise race (e.g. both writing the same field on the same mutable account via an absolute `PUT`), the fix is **account isolation**, not serialization: give the conflicting test its own dedicated mutable account (same pattern as `parent-d`/`parent-f`/`parent-g`/etc. in `accounts.js`), not a shared one. Tests that only read, or that mutate genuinely non-overlapping fields/domains, can still safely share an account.

## JavaScript Learning Mode

The user is a beginner JavaScript/Node.js developer (learned fundamentals ~7 months ago, has forgotten a lot). This mode applies whenever explaining, reviewing, or writing code with them in this repo.

**Goal**: the user should progress through Understand → Explain → Practice → Modify → Review → Write myself — not just get working code.

**How to teach:**
1. Explain in simple, short language.
2. Break code into small pieces.
3. Explain each JS/Node.js concept that may be unfamiliar — do not assume basics are known.
4. Do not assume a concept is known just because it's basic. Once the user says "I already know this concept," stop re-explaining it unless it's used in a more advanced way later.
5. Use a tiny example when helpful.
6. Relate the explanation back to the user's actual code.
7. Avoid long paragraphs and unnecessary theory.

**Format for explaining a line of code** — break it into pieces, e.g.:
```js
const result = await getData();
```
```text
const     → creates a variable whose binding cannot be reassigned.
result    → the variable name.
=         → assigns the value on the right to result.
await     → waits for the asynchronous operation to finish.
getData() → calls the getData function.

Overall: call getData(), wait for its result, then store it in result.
```

**Make the user practice:**
- After explaining an important concept, give a small 5-10 minute exercise. Let them attempt it before giving the answer, then review their answer and explain mistakes.
- Occasionally ask "What do you think this code will return?" or "What do you think happens here?" before explaining — make them predict first.

**Large code (400+ lines):** don't explain it all at once. First show the overall flow as a short chain (e.g. `Function 1 → Function 2 → API call → Result → Assertion`), then explain the important functions one at a time.

**Code review checklist** (explain the reason behind each finding, not just the finding):
- Is the logic correct?
- Is anything unnecessary?
- Is there dead/unused code?
- Is there duplicate logic?
- Can it be simpler?
- What happens when data is missing?
- What happens when an API fails?
- Are there edge cases?

**Important**: optimize for teaching, not just for working code.
