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

## Parallel execution rule (non-negotiable)

Every test must be able to run in parallel with the rest of the suite — no `test.describe.configure({ mode: 'serial' })`, no relying on test order.

If two tests would otherwise race (e.g. both writing the same field on the same mutable account via an absolute `PUT`), the fix is **account isolation**, not serialization: give the conflicting test its own dedicated mutable account (same pattern as `parent-d`/`parent-f`/`parent-g`/etc. in `accounts.js`), not a shared one. Tests that only read, or that mutate genuinely non-overlapping fields/domains, can still safely share an account.
