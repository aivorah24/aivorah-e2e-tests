# E2E Suite Progress

Running log of what's tested and passing, updated after each test run.

## Common (role-agnostic)

| File | Tests | Status |
|---|---|---|
| forgot-password.spec.js | 1 | passing |

Lives in `tests/common/`, not a persona folder - the Forgot Password popup and
its endpoint (`/user/send-password-reset`) are identical for every role, no
role branching in the code at all. Endpoint deliberately returns `{ ok: true
}` even for an email that isn't registered (avoids leaking which emails have
accounts), so the test doesn't need a real seeded account - any email works.

Uses a 20s timeout (longer than most assertions) - this endpoint makes real
Firebase Admin + email API calls, no mocking, so it's genuinely slower,
especially right after a server restart. Saw it fail once at 10s when run
alongside 18 other tests right after a restart, passed cleanly alone and on
retry - confirmed as a timing/cold-start flake, not a real bug, before
bumping the timeout.

## Login + signup + password-reset refactor in ai-mentor - now covers all 3
Extended the same day's refactor (see below) to `/user/send-password-reset`
too - moved into `services/auth-service.js` + `routes/auth.js`, same as
sync/role/send-verification/verify. Needed one more shared extraction first:
`services/firebaseAdmin.js` (the Firebase Admin SDK init), since it's also
used by other endpoints in `user.js` (change-email, delete-account) - same
"don't duplicate, extract to a shared file" pattern already used for
`getPreferences`/`setPreferences`. Verified with the full login+signup+
forgot-password suite after restart - all pass.

## Full-suite run after the login+signup refactor (2026-08-06) — verified clean
Ran the whole suite (`npx playwright test`, no filter) against the refactored
server, per the rule that a shared-code refactor (`/user/sync` runs on every
page load, not just login) needs the FULL suite re-verified, not just the
feature you touched — login/signup tests alone wouldn't catch a regression in
an unrelated screen that happens to depend on the same shared code.

Result: 77 ran, 70 passed, 7 failed. 3 of those 7 are the already-documented
known bugs (dashboard subject-list mismatch, onboarding grade/DOB mismatch,
profile Cambridge Grade 11/12 gap) - expected. The other 4 (parent signup,
profile save-all-fields, profile Sign Out x2) looked like real regressions at
first, but all 4 passed cleanly when re-run in isolation - confirmed as
resource contention from running 77 tests / 6 real browsers at once on one
machine (real network + email + Supabase calls all fighting for resources),
not caused by the refactor. Always re-run a suspicious full-suite failure in
isolation before calling it a regression - don't trust the first read.

## Student

| File | Tests | Status |
|---|---|---|
| b2b-login.spec.js | 3 | passing |
| email-signup.spec.js | 4 | passing |
| age-validation.spec.js | 2 | passing |
| onboarding.spec.js | 9 | 8 passing, 1 known bug (grade/DOB mismatch not validated) — see note below on the account-collision fix |
| dashboard.spec.js | 11 | 10 passing, 1 known bug (subject lists don't match). Display name test is FLAKY — app race, see below |
| dashboard-photo.spec.js | 1 | passing (headed) |
| profile.spec.js | 26 | 25 passing, 1 known app gap (Cambridge missing Grade 11/12 — intentionally red) |
| learning-paths.spec.js | 10 | passing |

## Learning flow — covered in layers, one file per layer
The learning feature is a flow, not a screen, so it's split by step:

| Layer | File | State |
|---|---|---|
| 1. Learning Paths | `learning-paths.spec.js` | done — 10 passing |
| 2. Subject Syllabus | `subject-syllabus.spec.js` | not started |
| 3. Lesson | `lesson.spec.js` | not started |
| 4. Quiz | `quiz.spec.js` | not started |
| 5. Math engine (different flow) | `math-learning.spec.js` | not started |

Useful facts found while writing Layer 1:
- These screens have real URLs — `page.goto('/learning-paths')` works, and so does
  `page.goBack()`. No need for the two-overlapping-sidebars click trick.
- `/subject-syllabus?subject=…&curriculum=…&grade=…` carries its state in the URL.
- Subjects come from `GET /curriculum/subjects` — loading, empty and error are all
  reachable with `page.route`, no special accounts needed.
- The card's size label is `chapters` (CBSE), `units` (IB PYP) or `topics`
  (fallback), decided per subject — assert the pattern, never a fixed word.
- After navigating, the screen you left stays in the DOM as hidden. `.first()` will
  happily match the old screen — use `.filter({ visible: true })`.
- **`.count()` does not wait.** It reads once and answers straight away. The screen
  title is drawn before the subjects arrive from the server, so counting cards right
  after the title appears can legitimately count zero — and the test then fails or
  passes depending on how quick the server was that run. This passed three runs in a
  row before failing. Wait for `expect(cards.first()).toBeVisible()` first, or use an
  assertion that retries (`toHaveCount`). Same applies to `allTextContents()`.
- A single green run proves nothing for timing bugs — re-run a new spec a few times
  before calling it done.

## Two things to check with the team (not yet asserted anywhere)
Both spotted on student-a (CBSE, Grade 3):
1. The header says **CBSE - Grade 3** but the hero chip right below says **NCERT** —
   two different names for the same curriculum on one screen. Code does this on
   purpose (`isCBSE ? 'CBSE' : curriculum` for the subtitle, raw `curriculum` for
   the chip), so it needs a product decision, not a fix.
2. The English card says **12 chapters**, but opening it shows **11 chapters**
   ("0 of 11 chapters started"). The count comes from a different source on each
   screen. Looks like a real bug — worth confirming before Layer 2 asserts on it.

## Photo upload — how it actually works (learned the hard way)
Expo's image picker builds a hidden `<input type="file">`, asks the browser for a
file, and **deletes the input as soon as it gets an answer**. If no Playwright
listener is attached, Playwright answers "no file" immediately, so the input is
already gone by the time `setInputFiles` looks for it — the test times out.

Use `page.waitForEvent('filechooser')` + `fileChooser.setFiles(...)`. Verified
headless. `headless: false` is NOT required for photo upload.
`dashboard-photo.spec.js` still uses the old headed workaround and can be
simplified the same way (not done yet).

## Display name — the save is fine, the refresh is racy (real app bug)
Pressing the tick **always** saves: `PATCH /user/profile` returns 200 and the new
name is there after a reload. What's unreliable is the popup — sometimes it shows
the new name immediately, sometimes it keeps the old one until you reload. Same
steps, same account, both outcomes seen in one session. So the display name test
is flaky until the app is fixed.

Worth knowing because it looks exactly like "the save button doesn't work", and
it looks exactly like a wrong selector (clicking the cross instead of the tick).
It's neither. Ways to tell them apart:
- the tick's icon colour is `rgb(11,11,11)` (`#0B0B0B`); the cross is `rgb(74,74,72)`
- only the tick fires a network call — cancel makes none
- if the name is there after `page.reload()`, the save ran

`updateUser()` in AuthContext does call `setUser`, so the fix belongs in the app,
not the test. Likely a profile refetch landing after the save and putting the old
name back.

Also: the tick and cross are plain boxes with an icon and **no button role**, so
`getByRole('button')` finds nothing there — that selector times out. Position
(`following-sibling::*[1]`) is what works today.

## Forms save the WHOLE form — check before splitting tests by field
The Edit Profile popup sends every field on Save, not just the one that changed
(`handleSaveProfile`, ProfileScreen.tsx). So "one test per field, sharing one
account" is NOT safe in parallel: each test sends the values it read when it
opened, and the last save silently undoes the others. It looks like a real app
bug — fields reverting to their old values — but it's the tests fighting.

Fix used here: one test that fills the whole form and saves once. Check how the
screen actually saves before writing per-field tests for teacher/parent/admin.

## Onboarding tests need one account each, not one shared account (real collision, not flakiness)
onboarding.spec.js originally shared a single account (student-d) across all 9
tests. Once login stopped driving the UI form (session reuse instead), the 9
tests started running close enough together that one test's `resetOnboarding()`
or completed-onboarding state would land while another test was still mid-fill
on the same account — the page changed out from under it and selectors like
"Your name" stopped matching, timing out.

Fix: each test now gets its own dedicated account (**student-d1** through
**student-d9**, one per test), added to `tests/helpers/accounts.js` and seeded
via `seed-e2e-suite.js` in the Aivorah app repo (that script's `ACCOUNTS` map
needed the same 9 entries added before seeding would create them). The old
`student-d` env var/account is left in place, unused, rather than deleted.

## PR #4 merged (2026-08-05)
"Student email signup, age validation, onboarding tests + session-reuse infra" —
covers b2b-login, email-signup, age-validation, onboarding, plus the
global-setup/teardown + session/auth/account helper infra every other spec
depends on. Still uncommitted, waiting on separate PRs: `profile.spec.js`,
`dashboard.spec.js`, `dashboard-photo.spec.js`, `learning-paths.spec.js`,
`tests/fixtures/`.

## Suite setup
- All tests run in parallel, each fully independent (see CLAUDE.md).
- `tests/global-setup.js` logs every account in once and saves the session to
  `.auth/`; tests reuse it via `tests/helpers/session.js` instead of logging in
  themselves (~0.3s vs ~9s per test).
- Accounts and which spec owns which are listed in `tests/helpers/accounts.js`.
  Read-only tests share **student-a**. profile.spec.js owns three, split by what
  they write: **student-c** (edit popup), **student-g** (avatar/learning
  style/subjects), **student-h** (photo — the avatar test deletes the photo, so
  it can't share with student-g).
- Mutable accounts are snapshotted before the run and restored by
  `tests/global-teardown.js`.
- Logins run 2 at a time (`BATCH_SIZE` in `global-setup.js`). Four at a time ran
  the 8GB dev machine out of RAM — Windows killed the browser and setup died with
  a misleading `Failed to find browser context` error. Raise it again on a bigger
  machine.
- That batch loop uses `Promise.allSettled`, not `Promise.all`. With `all`, the
  first failed login closed the browser under the others still running, and their
  crashes hid the real reason. Now failures are reported per account.

## Teacher

| File | Tests | Status |
|---|---|---|
| b2b-login.spec.js | 3 | passing |
| email-signup.spec.js | 1 | passing (valid signup only — empty name/invalid email/weak password are the exact same code as student's, tested once there, not repeated here) |

## Parent

| File | Tests | Status |
|---|---|---|
| b2b-login.spec.js | 3 | passing |
| email-signup.spec.js | 1 | passing (valid signup only, same reasoning as teacher above) |

## School Admin

| File | Tests | Status |
|---|---|---|
| b2b-login.spec.js | 3 | passing |

No self-signup for school-admin — the signup role picker only offers
student/teacher/parent (`ROLE_LABELS` in `LandingScreen.tsx`). Admin accounts
are provisioned separately, not self-registered.

## Login + signup refactor in ai-mentor (2026-08-06)
Per Sundaresan's plan: E2E first, refactor, re-verify, then (optionally)
extract to its own repo — one feature at a time, not everything at once.

**Login** (`/user/sync`) and then **signup** (`/user/role`,
`/user/send-verification`, `/user/verify/:token`) were pulled out of
`ai-mentor/server/routes/user.js` — a single 2,200-line file that also
handled photo upload, OTP, billing, and a dozen unrelated things — into:
- `services/auth-service.js` — the actual logic
- `routes/auth.js` — thin routes, just wire the request to the service
- `services/preferences.js` — small shared helper (`getPreferences`/
  `setPreferences`) that login depends on, pulled out so it's shared instead
  of duplicated

Verified after each move by rerunning the real E2E suite against the
restarted server — all 20 login+signup tests (12 login across 4 personas + 8
signup across 3) stayed green both times, nothing hand-waved.

**Also cleaned up as dead code while moving things**: an unused `crypto`
import and an unused `sendVerificationEmail` import in `routes/user.js`,
left behind once their only callers moved out.

**Not touched, on purpose:**
- Client-side `LoginModal`/`SignupModal` — still inline inside
  `LandingScreen.tsx` (1340 lines, also has the forgot-password modal and the
  whole logged-out homepage). Tangled up with shared UI pieces (`AuthModal`,
  `FormInput`, `GradientButton`, one shared StyleSheet) that Signup/Forgot
  still need — pulling just Login out cleanly would mean extracting all of
  that shared UI kit first. Bigger, separate task.
- `PATCH /user/preferences` and `GET /user/check-verified` — cohesive with
  auth but not something `signUpWithEmail()`/`signInWithEmail()` themselves
  call; left in `user.js` rather than scope-creeping the move.

**Real audit findings worth knowing about** (from reading the actual code,
not guessing): the "who is this user" role/onboarding/verification
resolution logic is duplicated ~4 times across `AuthContext.tsx` (normal
login, Google login, page-refresh, teacher→parent dual-role) with subtly
different edge-case handling each time. Also: `/user/sync` has no auth
middleware — it trusts whatever email the client sends, no ID-token
verification. Neither was in today's scope to fix, both worth flagging to
Sundaresan.

## Standalone auth microservice — proof, not deployed (2026-08-06)
Per Sundaresan's plan's last step: once refactored + re-verified, extract
into its own repo and prove it runs independently.

New repo: `github.com/aivorah24/aivorah-auth-service` (private). Contains the
same `routes/auth.js` + `services/auth-service.js` + `services/preferences.js`
+ `services/mailer.js` + `services/supabase.js`, with their own minimal
`package.json` (express, @supabase/supabase-js, cors, dotenv, resend,
nodemailer — nothing else from the big app).

Verified standalone by running it on `localhost:4001` (separate port, own
process) and hitting it directly — `tests/smoke.js` checks `/health`,
`/user/sync`, and `/user/role` against the real student/teacher/parent demo
accounts. All passed. `/user/send-verification` and `/user/verify/:token`
are deliberately NOT smoke-tested there since they mutate account state
(flip `accountStatus`, send a real email) — re-running that against the real
demo accounts every test run would break their verified state. Those two
stay covered by the Playwright signup specs here instead, which use
disposable per-run emails.

**Explicitly NOT done**: the live `ai-mentor` app has not been rewired to
call this service — it still runs its own copy of the same code. Actually
routing real traffic to a separate service (or a proxy in front of both)
is real infra work and a bigger decision, intentionally deferred rather than
rushed right before the Aug 31 deadline.

Repo also has its own `.github/PULL_REQUEST_TEMPLATE.md` and
`CONTRIBUTING.md` (branch → PR → merge discipline). Real GitHub branch
protection can't be turned on there either — same GitHub Free + private-repo
limit as this repo, documented instead of silently skipped.
