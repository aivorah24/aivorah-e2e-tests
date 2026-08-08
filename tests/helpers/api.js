// Direct, READ-ONLY Supabase lookup for the teacher's own DB id - the
// challenge-assign endpoint stores assigned_by_id raw (no email resolution,
// unlike assignments.js's resolveUserId), so we need the real id. Same
// admin-client pattern already used by resetProfile.js/resetOnboarding.js.
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function getTeacherIdByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();
  if (error || !data)
    throw new Error(`No user found for ${email}: ${error?.message ?? 'not found'}`);
  return data.id;
}

// Direct backend calls used to SEED activity for cross-persona tests
// (e.g. "student completes a topic -> teacher dashboard reflects it").
//
// We don't drive the student-side quiz UI for this - completing a topic
// legitimately requires reading a lesson and passing a multi-question quiz,
// which is its own (separate, not yet written) student-side test concern.
// Here we only care about the teacher dashboard reacting correctly to a
// completion that has already happened, so we create that completion
// directly against the same endpoint the app itself calls.

// Looks up a student's DB id from a teacher's roster by matching email -
// the dashboard's own by-teacher endpoint already returns this, so this
// is exactly what the app itself resolves against, not a guess.
export async function getStudentIdByEmail(request, { teacherEmail, studentEmail }) {
  const res = await request.get(`/student/by-teacher/${encodeURIComponent(teacherEmail)}`);
  if (!res.ok()) {
    throw new Error(`GET /student/by-teacher/${teacherEmail} failed: ${res.status()}`);
  }
  const students = await res.json();
  const match = students.find((s) => s.email === studentEmail);
  if (!match) {
    throw new Error(
      `No student with email ${studentEmail} found under teacher ${teacherEmail}. ` +
        `Check the TEACHER_LINKS entry in seed-e2e-suite.js.`,
    );
  }
  return match.id;
}

// Marks a topic complete for a student, the same way the real Learn5E /
// IBPYPQuiz screens do after a passed quiz (StudentDataContext.completeLesson).
export async function completeLesson(request, studentId, { topic, subject, grade, curriculum }) {
  const res = await request.post(`/student/${studentId}/complete-lesson`, {
    data: { topic, subject, grade, curriculum },
  });
  if (!res.ok()) {
    throw new Error(`POST /student/${studentId}/complete-lesson failed: ${res.status()}`);
  }
  return res.json();
}

// Logs study time the same way a real lesson screen does while a student is
// reading/working through it (source: 'learningPath' is what updates the
// per-subject learning_path_minutes the teacher dashboard reads) - separate
// from completeLesson, which only fires once at the END of a session and
// never touches study time itself. A real student session does both.
export async function logStudyTime(request, studentId, { minutes, subject }) {
  const res = await request.post(`/student/${studentId}/study-time`, {
    data: { minutes, source: 'learningPath', subject },
  });
  if (!res.ok()) {
    throw new Error(
      `POST /student/${studentId}/study-time failed: ${res.status()} ${await res.text()}`,
    );
  }
  return res.json();
}

// Records a quiz result the same way the real NCERT/IB PYP quiz screens do
// (POST /analytics/track) - this, not complete-lesson, is what Parent
// Dashboard's Subject Performance card actually reads (routes/parent.js
// ai-report handler builds subjectPerformance from analytics events with
// eventType 'ncert_quiz_result' / 'ibpyp_quiz_result', matched by
// userEmail - confirmed via code read, complete-lesson's own topic_attempts
// insert is unrelated/unused here).
export async function trackQuizResult(
  request,
  { studentEmail, curriculum, topic, subject, score },
) {
  const eventType = curriculum === 'IB PYP' ? 'ibpyp_quiz_result' : 'ncert_quiz_result';
  const res = await request.post('/analytics/track', {
    data: { eventType, userEmail: studentEmail, topic, subject, score },
  });
  if (!res.ok()) {
    throw new Error(`POST /analytics/track failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

// Marks attendance for a student on a given date, the same way the
// teacher's attendance-marking screen does (POST /attendance/save). Upserts
// per date+studentId, so calling it twice with the same date just overwrites
// that one record rather than double-counting.
export async function markAttendance(request, { date, studentId, status }) {
  const res = await request.post('/attendance/save', {
    data: { date, records: { [studentId]: status } },
  });
  if (!res.ok()) {
    throw new Error(`POST /attendance/save failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

// Creates a quiz-type assignment for a specific student (POST /assignments).
// Uses `type: 'quiz'` with one real MCQ question, not a plain 'assignment' -
// plain assignments have NO server-side scoring path at all (routes/
// assignments.js's POST /:id/submit doesn't even read a client-supplied
// score), so an assignment-analytics test needs a quiz to get a real,
// non-null score. MCQ grading (unlike free-text) is deterministic backend
// code, not an AI call, so the outcome here is exact and not flaky.
export async function createAssignment(request, { teacherId, studentId, title, dueDate, subject }) {
  const res = await request.post('/assignments', {
    data: {
      title,
      dueDate,
      studentId,
      createdById: teacherId,
      createdByRole: 'teacher',
      subject,
      type: 'quiz',
      quizQuestions: [
        {
          question: 'What is 7 + 5?',
          type: 'mcq',
          options: ['12', '10', '13', '11'],
          correct: '12',
        },
      ],
    },
  });
  if (!res.ok()) {
    throw new Error(`POST /assignments failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

// Submits the quiz as a student with the correct MCQ answer, the same way
// the real submit flow does - scores 100 deterministically (see
// createAssignment's comment on why plain assignments can't be used here).
export async function submitAssignment(request, assignmentId, { studentId }) {
  const res = await request.post(`/assignments/${assignmentId}/submit`, {
    data: { studentId, quizAnswers: [{ answer: '12' }] },
  });
  if (!res.ok()) {
    throw new Error(
      `POST /assignments/${assignmentId}/submit failed: ${res.status()} ${await res.text()}`,
    );
  }
  return res.json();
}

// Looks up a parent's linked child id by email (GET /parent/:email/children -
// the same call ParentChallengesScreen itself makes to build its child list).
export async function getChildIdByParentEmail(request, { parentEmail, childEmail }) {
  const res = await request.get(`/parent/${encodeURIComponent(parentEmail)}/children`);
  if (!res.ok()) {
    throw new Error(`GET /parent/${parentEmail}/children failed: ${res.status()}`);
  }
  const children = await res.json();
  const match = children.find((c) => c.email === childEmail);
  if (!match) {
    throw new Error(
      `No child with email ${childEmail} found under parent ${parentEmail}. ` +
        `Check the PARENT_LINKS entry in seed-e2e-suite.js.`,
    );
  }
  return match.id;
}

// Lists the real challenges available for a grade/curriculum - used to pick
// a real challengeId instead of guessing one. Passing studentId includes
// each challenge's assignment status for that student (GET /challenges?
// studentId=... in routes/challenges.js), so a test can pick one that
// isn't already 'completed' from a previous run - re-completing the same
// challenge_assignments row doesn't increment totals a second time.
export async function listChallenges(request, { grade, curriculum, studentId }) {
  const params = new URLSearchParams({ grade, curriculum });
  if (studentId) params.set('studentId', studentId);
  const res = await request.get(`/challenges?${params.toString()}`);
  if (!res.ok()) {
    throw new Error(`GET /challenges failed: ${res.status()}`);
  }
  return res.json();
}

// Assigns a challenge to a student, the same way a teacher's "Assign
// Challenge" flow does (POST /challenges/assign).
export async function assignChallenge(request, { challengeId, studentId, teacherId }) {
  const res = await request.post('/challenges/assign', {
    data: { challengeId, studentId, assignedById: teacherId, assignedByRole: 'teacher' },
  });
  if (!res.ok()) {
    throw new Error(`POST /challenges/assign failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

// Assigns a challenge the same way ParentChallengesScreen's "Assign to Child"
// flow does - assignedById is the parent's EMAIL, not a DB id (unlike the
// teacher flow above, ParentChallengesScreen passes `user.email` straight
// through - see doAssign in ParentChallengesScreen.tsx).
export async function assignChallengeAsParent(
  request,
  { challengeId, studentId, parentEmail, dueDate },
) {
  const res = await request.post('/challenges/assign', {
    data: { challengeId, studentId, assignedById: parentEmail, assignedByRole: 'parent', dueDate },
  });
  if (!res.ok()) {
    throw new Error(`POST /challenges/assign failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

// Directly syncs a student's stats via PUT /student/:id - the same
// full-stats-sync endpoint the app's own client tabs call whenever local
// state changes (routes/student.js). Used to set fields that no other real
// endpoint increments server-side (currentStreak, xpPoints, assignmentsDone -
// confirmed via code read: nothing else in the backend writes
// assignments_done or current_streak), so this is the real, app-native way
// to reach those values, not a fabricated shortcut.
export async function setStudentStats(request, studentId, patch) {
  const res = await request.put(`/student/${studentId}`, { data: patch });
  if (!res.ok()) {
    throw new Error(`PUT /student/${studentId} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

// Completes an assigned challenge as a student (POST /challenges/:id/complete).
export async function completeChallenge(request, assignmentId, { studentId, score }) {
  const res = await request.post(`/challenges/${assignmentId}/complete`, {
    data: { studentId, score },
  });
  if (!res.ok()) {
    throw new Error(
      `POST /challenges/${assignmentId}/complete failed: ${res.status()} ${await res.text()}`,
    );
  }
  return res.json();
}
