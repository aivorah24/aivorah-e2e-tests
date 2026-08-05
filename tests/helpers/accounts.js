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
  'student-d1': { email: process.env.E2E_STUDENT_D1, role: 'student', school: 'TSRA', mutable: true },
  'student-d2': { email: process.env.E2E_STUDENT_D2, role: 'student', school: 'TSRA', mutable: true },
  'student-d3': { email: process.env.E2E_STUDENT_D3, role: 'student', school: 'TSRA', mutable: true },
  'student-d4': { email: process.env.E2E_STUDENT_D4, role: 'student', school: 'TSRA', mutable: true },
  'student-d5': { email: process.env.E2E_STUDENT_D5, role: 'student', school: 'TSRA', mutable: true },
  'student-d6': { email: process.env.E2E_STUDENT_D6, role: 'student', school: 'TSRA', mutable: true },
  'student-d7': { email: process.env.E2E_STUDENT_D7, role: 'student', school: 'TSRA', mutable: true },
  'student-d8': { email: process.env.E2E_STUDENT_D8, role: 'student', school: 'TSRA', mutable: true },
  'student-d9': { email: process.env.E2E_STUDENT_D9, role: 'student', school: 'TSRA', mutable: true },
  'student-e': { email: process.env.E2E_STUDENT_E, role: 'student', school: 'TSRA', mutable: true },
  'student-f': { email: process.env.E2E_STUDENT_F, role: 'student', school: 'TSRA', mutable: true },
  'student-g': { email: process.env.E2E_STUDENT_G, role: 'student', school: 'TSRA', mutable: true },
  'student-h': { email: process.env.E2E_STUDENT_H, role: 'student', school: 'TSRA', mutable: true },
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
};

export function accountFor(key) {
  const account = ACCOUNTS[key];
  if (!account) throw new Error(`Unknown test account "${key}".`);
  if (!account.email) throw new Error(`Missing .env email for test account "${key}".`);
  return account;
}
