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
