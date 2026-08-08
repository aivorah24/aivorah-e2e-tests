// The 15 test accounts, in one place.
//
// The important column here is "mutable". Our tests all run at the same time
// (see CLAUDE.md), so two tests writing the same field on the same account
// would trip over each other.
//
// The rule we follow:
//   - read-only accounts: any number of tests can share them, because nothing
//     they do changes the account.
//   - mutable accounts: exactly ONE spec file owns each one. If you add a spec
//     that saves something, give it its own account rather than borrowing.
//
// Seeded by ai-mentor/server/scripts/seed-e2e-suite.js.

export const PASSWORD = process.env.E2E_PASSWORD;

export const ACCOUNTS = {
  // ── school_admin ──
  'admin-a': {
    email: process.env.E2E_ADMIN_A,
    role: 'school_admin',
    school: 'TSRA',
    mutable: false,
  },
  'admin-b': {
    email: process.env.E2E_ADMIN_B,
    role: 'school_admin',
    school: 'E2E School Mutate',
    mutable: true,
  },
  'admin-c': {
    email: process.env.E2E_ADMIN_C,
    role: 'school_admin',
    school: 'E2E School Isolation',
    mutable: false,
  },

  // ── teacher ──
  'teacher-a': {
    email: process.env.E2E_TEACHER_A,
    role: 'teacher',
    school: 'TSRA',
    mutable: false,
  },
  'teacher-b': { email: process.env.E2E_TEACHER_B, role: 'teacher', school: 'TSRA', mutable: true },
  'teacher-c': {
    email: process.env.E2E_TEACHER_C,
    role: 'teacher',
    school: 'E2E School Content',
    mutable: true,
  },

  // ── parent ──
  'parent-a': { email: process.env.E2E_PARENT_A, role: 'parent', school: 'TSRA', mutable: false },
  'parent-b': { email: process.env.E2E_PARENT_B, role: 'parent', school: 'TSRA', mutable: true },
  'parent-c': { email: process.env.E2E_PARENT_C, role: 'parent', school: 'TSRA', mutable: true },
  'parent-d': { email: process.env.E2E_PARENT_D, role: 'parent', school: 'TSRA', mutable: true },
  // Read-only - the only parent linked to TWO children (student-a,
  // student-b), for the Parent Dashboard child-switching spec.
  'parent-e': { email: process.env.E2E_PARENT_E, role: 'parent', school: 'TSRA', mutable: false },
  // Mutable - dedicated to the Weekly Snapshot spec (writes to
  // student-parent-f). Separate from parent-e (order-sensitive child-switching
  // test) and parent-d (owned by the Challenges spec).
  'parent-f': { email: process.env.E2E_PARENT_F, role: 'parent', school: 'TSRA', mutable: true },
  // Mutable - dedicated to the Achievements spec (pushes student-parent-g
  // past each badge threshold via real API calls). Separate account so
  // streak/XP mutations here can't collide with parent-d/parent-f's own.
  'parent-g': { email: process.env.E2E_PARENT_G, role: 'parent', school: 'TSRA', mutable: true },
  // Read-only - deliberately has zero linked children, for the Parent
  // Dashboard empty/error-state specs (same role teacher-b plays for the
  // teacher-dashboard empty-state spec).
  'parent-h': { email: process.env.E2E_PARENT_H, role: 'parent', school: 'TSRA', mutable: false },
  // parent-f2..f7 - each dedicated to exactly ONE weekly-snapshot.spec.js
  // test that mutates student_stats fields (currentStreak/xpPoints/
  // studyTimeMinutes) via absolute PUT sets. Splitting these out is what
  // lets that file's 7 tests run in parallel instead of serial - see
  // OWNERSHIP below for which test owns which.
  'parent-f2': { email: process.env.E2E_PARENT_F2, role: 'parent', school: 'TSRA', mutable: true },
  'parent-f3': { email: process.env.E2E_PARENT_F3, role: 'parent', school: 'TSRA', mutable: true },
  'parent-f4': { email: process.env.E2E_PARENT_F4, role: 'parent', school: 'TSRA', mutable: true },
  'parent-f5': { email: process.env.E2E_PARENT_F5, role: 'parent', school: 'TSRA', mutable: true },
  'parent-f6': { email: process.env.E2E_PARENT_F6, role: 'parent', school: 'TSRA', mutable: true },
  'parent-f7': { email: process.env.E2E_PARENT_F7, role: 'parent', school: 'TSRA', mutable: true },
  // Mutable - dedicated to the Parent Profile spec (PATCHes its own name/
  // phone/location via PATCH /user/profile). Linked read-only to student-a
  // for the Activity Overview card's "N kids" count - never mutates
  // student-a itself.
  'parent-i': { email: process.env.E2E_PARENT_I, role: 'parent', school: 'TSRA', mutable: true },

  // ── student ──
  'student-a': {
    email: process.env.E2E_STUDENT_A,
    role: 'student',
    school: 'TSRA',
    mutable: false,
  },
  'student-b': { email: process.env.E2E_STUDENT_B, role: 'student', school: 'TSRA', mutable: true },
  'student-c': { email: process.env.E2E_STUDENT_C, role: 'student', school: 'TSRA', mutable: true },
  // student-d1..d9: one account per onboarding test (see OWNERSHIP below).
  // Onboarding writes the onboarding_completed flag, and the 9 onboarding
  // tests all run in parallel - sharing one account meant one test's reset
  // or completed-onboarding state stomped on another mid-run.
  'student-d1': {
    email: process.env.E2E_STUDENT_D1,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d2': {
    email: process.env.E2E_STUDENT_D2,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d3': {
    email: process.env.E2E_STUDENT_D3,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d4': {
    email: process.env.E2E_STUDENT_D4,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d5': {
    email: process.env.E2E_STUDENT_D5,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d6': {
    email: process.env.E2E_STUDENT_D6,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d7': {
    email: process.env.E2E_STUDENT_D7,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d8': {
    email: process.env.E2E_STUDENT_D8,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-d9': {
    email: process.env.E2E_STUDENT_D9,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-e': { email: process.env.E2E_STUDENT_E, role: 'student', school: 'TSRA', mutable: true },
  'student-f': { email: process.env.E2E_STUDENT_F, role: 'student', school: 'TSRA', mutable: true },
  'student-g': { email: process.env.E2E_STUDENT_G, role: 'student', school: 'TSRA', mutable: true },
  'student-h': { email: process.env.E2E_STUDENT_H, role: 'student', school: 'TSRA', mutable: true },
  // Linked to teacher-a for Mathematics (see TEACHER_LINKS in seed-e2e-suite.js) -
  // the only student account wired to a teacher, so teacher-dashboard analytics
  // specs (Learning Path / Assignment / Challenge) can drive real activity and
  // check it reflects on teacher-a's dashboard.
  'student-teacher-a': {
    email: process.env.E2E_STUDENT_TEACHER_A,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  // Linked to parent-d, CBSE/Grade 3 (same reason as student-teacher-a - the
  // `challenges` table has zero rows for NCERT), so the Parent Challenges
  // spec can assign/complete real challenges without disturbing parent-a
  // (shared, read-only, NCERT - always empty-state for challenges).
  'student-parent-d': {
    email: process.env.E2E_STUDENT_PARENT_D,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  // Linked to parent-f only - dedicated to the Weekly Snapshot spec's
  // study-time/topic-completion mutations.
  'student-parent-f': {
    email: process.env.E2E_STUDENT_PARENT_F,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  // Linked to parent-g only - starts with zero achievement badges; the
  // Achievements spec pushes it past each threshold and checks the badge
  // unlocks.
  'student-parent-g': {
    email: process.env.E2E_STUDENT_PARENT_G,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  // Linked to parent-f2..f7 respectively (one pair per weekly-snapshot.spec.js
  // test) - see parent-f2..f7's comment above.
  'student-parent-f2': {
    email: process.env.E2E_STUDENT_PARENT_F2,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-parent-f3': {
    email: process.env.E2E_STUDENT_PARENT_F3,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-parent-f4': {
    email: process.env.E2E_STUDENT_PARENT_F4,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-parent-f5': {
    email: process.env.E2E_STUDENT_PARENT_F5,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-parent-f6': {
    email: process.env.E2E_STUDENT_PARENT_F6,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
  'student-parent-f7': {
    email: process.env.E2E_STUDENT_PARENT_F7,
    role: 'student',
    school: 'TSRA',
    mutable: true,
  },
};

// Which spec file owns which mutable account. Keeping this written down means
// the next person can see at a glance whether an account is already spoken for.
export const OWNERSHIP = {
  'student-b': 'tests/student/dashboard.spec.js  (display name, profile photo)',
  'student-c':
    'tests/student/profile.spec.js    (edit-popup fields: name, school, bio, location, curriculum, grade)',
  'student-g':
    'tests/student/profile.spec.js    (avatar style, learning style, interests - these write user_preferences, not the popup fields)',
  'student-h':
    'tests/student/profile.spec.js    (profile photo only - the avatar test deletes the photo, so it cannot share with student-g)',
  'student-d1..d9':
    'tests/student/onboarding.spec.js (one account per test - onboarding_completed flag)',
  'student-e': 'parent screen-time tests         (lock flag written by parent-b)',
  'student-f': 'parent screen-time tests         (lock flag written by parent-c)',
  'teacher-b': 'teacher profile/settings tests',
  'teacher-c': 'teacher content creation tests',
  'parent-b': 'parent controls tests            (writes to student-e)',
  'parent-c': 'parent controls tests            (writes to student-f)',
  'admin-b': 'school-admin mutation tests       (create/delete student)',
  'student-teacher-a':
    'tests/teacher/*-analytics.spec.js (Learning Path / Assignment / Challenge dashboard analytics)',
  'parent-d':
    'tests/parent/challenges/challenges.spec.js (assign/complete a challenge, writes to student-parent-d)',
  'student-parent-d': 'tests/parent/challenges/challenges.spec.js (assigned/completed by parent-d)',
  'parent-f': 'weekly-snapshot.spec.js (topic + study-time -> Learning Journey/Mission/Growth)',
  'student-parent-f': 'weekly-snapshot.spec.js (mutated by parent-f)',
  'parent-f2': 'weekly-snapshot.spec.js (Attendance Record display + marking)',
  'student-parent-f2': 'weekly-snapshot.spec.js (mutated by parent-f2)',
  'parent-f3': 'weekly-snapshot.spec.js (Activity Overview graph, study-time)',
  'student-parent-f3': 'weekly-snapshot.spec.js (mutated by parent-f3)',
  'parent-f4': 'weekly-snapshot.spec.js (Subject Performance quiz)',
  'student-parent-f4': 'weekly-snapshot.spec.js (mutated by parent-f4)',
  'parent-f5': 'weekly-snapshot.spec.js (Learning Mood, currentStreak)',
  'student-parent-f5': 'weekly-snapshot.spec.js (mutated by parent-f5)',
  'parent-f6': 'weekly-snapshot.spec.js (Learning Highlights, xpPoints+currentStreak)',
  'student-parent-f6': 'weekly-snapshot.spec.js (mutated by parent-f6)',
  'parent-f7': 'weekly-snapshot.spec.js (Top Interest/Learning Style/AI Insight)',
  'student-parent-f7': 'weekly-snapshot.spec.js (mutated by parent-f7)',
  'parent-i': 'tests/parent/profile/profile.spec.js (PATCHes its own name/phone/location)',
  'parent-g':
    'tests/parent/dashboard/achievements/achievements.spec.js (writes to student-parent-g)',
  'student-parent-g':
    'tests/parent/dashboard/achievements/achievements.spec.js (mutated by parent-g)',
};

export function accountFor(key) {
  const account = ACCOUNTS[key];
  if (!account) throw new Error(`Unknown test account "${key}".`);
  if (!account.email) throw new Error(`Missing .env email for test account "${key}".`);
  return account;
}
