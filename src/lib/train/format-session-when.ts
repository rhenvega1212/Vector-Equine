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

/** Short list title (drop legacy “Capture lesson · datetime” stamps). */
export function sessionDisplayTitle(
  title: string | null | undefined,
  fallback: string
): string {
  const t = title?.trim();
  if (!t) return fallback;
  // Legacy capture stamps — date/time already shown beside the card
  if (/^Capture lesson\b/i.test(t)) return "Lesson";
  return t;
}

/**
 * @deprecated Prefer summarizeCaptureTranscript().title — kept for any leftover callers.
 */
export function captureLessonTitle(t0Iso: string, now = new Date()): string {
  const start = new Date(t0Iso);
  const when = isValid(start) ? start : now;
  const h = when.getHours();
  const daypart =
    h < 11
      ? "Morning schooling"
      : h < 15
        ? "Midday schooling"
        : h < 19
          ? "Afternoon schooling"
          : "Evening schooling";
  return daypart;
}
