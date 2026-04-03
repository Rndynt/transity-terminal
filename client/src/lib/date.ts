/**
 * Format a Date to YYYY-MM-DD using LOCAL timezone (not UTC).
 * toISOString() always returns UTC which causes wrong dates for UTC+x timezones.
 */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Returns today as YYYY-MM-DD in local timezone */
export function todayStr(): string {
  return localDateStr(new Date());
}

/** Returns N days ago as YYYY-MM-DD in local timezone */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

/** Returns N days from today as YYYY-MM-DD in local timezone */
export function daysFromNowStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}
