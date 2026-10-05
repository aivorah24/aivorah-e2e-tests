// Locators for Attendance: TeacherAttendanceScreen.tsx (teacher marks a class)
// and ParentAttendanceScreen.tsx ("Attendance Portal", URL /parent/attendance).
// Neither screen has testIDs yet - text locators until the refactor adds them.

// The sidebar is rendered twice (mobile + desktop), so take the visible copy.
export function sidebarAttendanceLink(page) {
  return page.getByText('Attendance', { exact: true }).filter({ visible: true }).first();
}

// "Unmarked" is a stat label that only exists on the teacher Attendance screen.
export function teacherAttendanceScreen(page) {
  return page.getByText('Unmarked', { exact: true }).filter({ visible: true }).first();
}

export function saveAttendanceButton(page) {
  return page.getByText('Save Daily Attendance', { exact: true });
}

// One stat card (Present/Absent/Late/Unmarked): the number and its label share a parent.
export function statCard(page, label) {
  return page.getByText(label, { exact: true }).filter({ visible: true }).first().locator('xpath=..');
}

export function parentAttendancePortal(page) {
  return page.getByText('Attendance Portal', { exact: true }).filter({ visible: true }).first();
}
