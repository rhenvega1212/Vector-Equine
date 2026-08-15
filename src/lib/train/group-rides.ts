import {
  addHomeCalendarDays,
  calendarDateInHomeTz,
  formatHomeCalendarDate,
  HOME_TIMEZONE,
} from "@/lib/timezone";
import { TZDate } from "@date-fns/tz";

export type RideGroup<T> = {
  label: string;
  rides: T[];
};

/** Sunday (inclusive) of the week containing ymd, America/Chicago. */
function weekStartSunday(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const noon = new TZDate(y, m - 1, d, 12, 0, 0, HOME_TIMEZONE);
  const dow = noon.getDay(); // 0 = Sunday
  return addHomeCalendarDays(ymd.slice(0, 10), -dow);
}

/**
 * Group rides: THIS WEEK · LAST WEEK · EARLIER IN {MONTH} / month labels.
 */
export function groupRidesByDate<T extends { session_date: string }>(
  rides: T[],
  now = new Date()
): RideGroup<T>[] {
  const today = calendarDateInHomeTz(now);
  const thisWeekStart = weekStartSunday(today);
  const lastWeekStart = addHomeCalendarDays(thisWeekStart, -7);
  const lastWeekEnd = addHomeCalendarDays(thisWeekStart, -1);

  const thisWeek: T[] = [];
  const lastWeek: T[] = [];
  const byMonth = new Map<string, T[]>();

  for (const r of rides) {
    const day = r.session_date.slice(0, 10);
    if (day >= thisWeekStart) {
      thisWeek.push(r);
    } else if (day >= lastWeekStart && day <= lastWeekEnd) {
      lastWeek.push(r);
    } else {
      const key = day.slice(0, 7);
      const list = byMonth.get(key) || [];
      list.push(r);
      byMonth.set(key, list);
    }
  }

  const groups: RideGroup<T>[] = [];
  if (thisWeek.length) groups.push({ label: "THIS WEEK", rides: thisWeek });
  if (lastWeek.length) groups.push({ label: "LAST WEEK", rides: lastWeek });

  const monthKeys = Array.from(byMonth.keys()).sort((a, b) =>
    b.localeCompare(a)
  );
  const currentMonth = today.slice(0, 7);
  for (const key of monthKeys) {
    const sample = `${key}-15`;
    const monthName = formatHomeCalendarDate(sample, "MMMM").toUpperCase();
    const label =
      key === currentMonth ? `EARLIER IN ${monthName}` : monthName;
    groups.push({ label, rides: byMonth.get(key)! });
  }

  return groups;
}
