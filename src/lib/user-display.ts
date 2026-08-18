// Single, consistent way to show "who" a user is anywhere in the UI.
// Per explicit product decision: NEVER show an email address as a user's
// identity — not the synthetic internal auth email, and not even a real
// one. Always prefer their name, falling back to their Employee ID.
type DisplayableUser =
  | {
      employee_id?: string | null;
      display_name_ar?: string | null;
      display_name_en?: string | null;
    }
  | null
  | undefined;

export function userDisplayLabel(u: DisplayableUser, locale: string): string {
  if (!u) return "—";
  const name = locale === "ar" ? u.display_name_ar || u.display_name_en : u.display_name_en || u.display_name_ar;
  if (name) return name;
  if (u.employee_id) return `#${u.employee_id}`;
  return "—";
}

export function userInitials(u: DisplayableUser, locale: string): string {
  const label = userDisplayLabel(u, locale);
  return label.replace(/^#/, "").slice(0, 2).toUpperCase();
}
