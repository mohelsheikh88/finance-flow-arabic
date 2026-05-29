/**
 * Translate Postgres lock-date trigger errors into clear, localized
 * user-facing messages with a suggested next available date.
 *
 * Matches messages thrown by enforce_lock_date_* triggers:
 *   "Date YYYY-MM-DD is locked. ..."
 *   "Cannot modify ...: original date YYYY-MM-DD is locked."
 *   "Cannot delete ...: date YYYY-MM-DD is locked."
 */
export type LockErrorT = (key: string, vars?: Record<string, string>) => string;

const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function isLockError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /is locked|lock date|locked\./i.test(msg);
}

export function formatLockError(err: unknown, t: LockErrorT): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (!isLockError(err)) return raw;

  const m = raw.match(DATE_RE);
  const lockedDate = m?.[1];
  const suggested = lockedDate ? nextDay(lockedDate) : null;

  if (lockedDate && suggested) {
    return t("lockDates.errorWithSuggestion", { date: lockedDate, next: suggested });
  }
  return t("lockDates.errorGeneric");
}
