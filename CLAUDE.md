# Aivorah E2E Tests — Working Rules

## Secrets
- Render MCP API key is stored in `C:\Users\Asus\.claude.json` (user home dir, outside this repo). Never commit that file or paste its contents anywhere.

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
