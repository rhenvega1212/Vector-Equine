import { TZDate } from "@date-fns/tz";
import { format, isValid } from "date-fns";

/** Barn / product home base — Central Time (CST/CDT). */
export const HOME_TIMEZONE = "America/Chicago";

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Format an instant in America/Chicago (works on Vercel UTC and any browser). */
export function formatInHomeTz(
  value: Date | string | number,
  pattern: string
): string {
  const d = asDate(value);
  if (!isValid(d)) return "";
  return format(new TZDate(d, HOME_TIMEZONE), pattern);
}

/** Calendar day YYYY-MM-DD in America/Chicago. */
export function calendarDateInHomeTz(
  value: Date | string | number = new Date()
): string {
  const d = asDate(value);
  if (!isValid(d)) return "";
  return d.toLocaleDateString("en-CA", { timeZone: HOME_TIMEZONE });
}

/** Hour of day 0–23 in America/Chicago. */
export function hourInHomeTz(value: Date | string | number = new Date()): number {
  const d = asDate(value);
  if (!isValid(d)) return 12;
  return new TZDate(d, HOME_TIMEZONE).getHours();
}

/**
 * Format a stored calendar date (YYYY-MM-DD) without shifting the day.
 * Treats the string as a Central calendar day, not a UTC midnight instant.
 */
export function formatHomeCalendarDate(
  ymd: string,
  pattern: string
): string {
  const raw = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = asDate(raw);
    return isValid(d) ? formatInHomeTz(d, pattern) : raw;
  }
  const [y, m, day] = raw.slice(0, 10).split("-").map(Number);
  return format(new TZDate(y, m - 1, day, 12, 0, 0, HOME_TIMEZONE), pattern);
}

/** Add calendar days in America/Chicago; returns YYYY-MM-DD. */
export function addHomeCalendarDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const t = new TZDate(y, m - 1, d, 12, 0, 0, HOME_TIMEZONE);
  t.setDate(t.getDate() + deltaDays);
  return t.toLocaleDateString("en-CA", { timeZone: HOME_TIMEZONE });
}
