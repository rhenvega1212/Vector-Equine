import { format, parseISO, isValid } from "date-fns";

/** Human-readable when a session was taken (date + time when available). */
export function formatSessionWhen(
  sessionDate: string,
  createdAt?: string | null,
  opts?: { includeYear?: boolean }
): string {
  const includeYear = opts?.includeYear ?? true;
  let dayLabel = sessionDate;
  try {
    const d = parseISO(sessionDate.length <= 10 ? `${sessionDate}T12:00:00` : sessionDate);
    if (isValid(d)) {
      dayLabel = format(d, includeYear ? "MMM d, yyyy" : "MMM d");
    }
  } catch {
    /* keep raw */
  }

  if (!createdAt) return dayLabel;

  try {
    const t = parseISO(createdAt);
    if (isValid(t)) {
      return `${dayLabel} · ${format(t, "h:mm a")}`;
    }
  } catch {
    /* ignore */
  }
  return dayLabel;
}

/** Short list title (drop embedded datetime stamp from capture titles). */
export function sessionDisplayTitle(
  title: string | null | undefined,
  fallback: string
): string {
  const t = title?.trim();
  if (!t) return fallback;
  if (t.startsWith("Capture lesson")) return "Capture lesson";
  return t;
}

/** Title stamp used when ending a Capture Live lesson. */
export function captureLessonTitle(t0Iso: string, now = new Date()): string {
  const start = new Date(t0Iso);
  const when = isValid(start) ? start : now;
  return `Capture lesson · ${format(when, "MMM d, yyyy · h:mm a")}`;
}
