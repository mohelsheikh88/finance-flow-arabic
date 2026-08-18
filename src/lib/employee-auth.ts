// Employees log in with their Employee ID instead of typing an email.
// Supabase Auth still needs *an* email under the hood, so we deterministically
// derive a synthetic one from the Employee ID (never actually emailed to
// anyone — it's purely an internal auth identifier). The person's real
// contact email, if they have one, is stored separately on their profile.
export const EMPLOYEE_AUTH_DOMAIN = "employees.alhayat.internal";

export function employeeIdToAuthEmail(employeeId: string): string {
  const normalized = employeeId.trim().toLowerCase().replace(/\s+/g, "");
  return `emp-${normalized}@${EMPLOYEE_AUTH_DOMAIN}`;
}

export function isLikelyEmail(value: string): boolean {
  return value.includes("@");
}
