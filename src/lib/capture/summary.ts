import { hourInHomeTz } from "@/lib/timezone";

export type TranscriptSeg = {
  speaker: string;
  text: string;
  offset_ms: number;
};

export type CueReelItem = {
  offset_ms: number;
  text: string;
  speaker: "trainer" | "rider";
};

export type CaptureBrief = {
  /** Short theme title for lists / debrief header (not a datetime stamp). */
  title: string;
  focus: string;
  summary: string;
  homework: string;
  exercises: string;
  keyPhrases: string[];
  cues: CueReelItem[];
};

const EXERCISE_RE =
  /circle|trot|canter|walk|halt|leg.?yield|shoulder|haunches|transition|serpentine|figure|half.?pass|pirouette|counter|lengthen|collect|stretch/i;

/** Ordered: more specific patterns win first. */
const THEME_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /half.?pass/i, label: "Half-pass" },
  { re: /pirouette/i, label: "Pirouette" },
  { re: /shoulder.?in/i, label: "Shoulder-in" },
  { re: /haunches.?in|travers/i, label: "Haunches-in" },
  { re: /leg.?yield/i, label: "Leg-yield" },
  { re: /counter.?canter/i, label: "Counter-canter" },
  { re: /serpentine/i, label: "Serpentines" },
  { re: /figure.?8|figure.?eight/i, label: "Figure eights" },
  { re: /spiral/i, label: "Spiral work" },
  { re: /canter.+transition|transition.+canter|into canter|to canter/i, label: "Canter transitions" },
  { re: /trot.+transition|transition.+trot|into trot|to trot/i, label: "Trot transitions" },
  { re: /walk.?halt|halt.?walk/i, label: "Walk–halt" },
  { re: /lengthen|extend(?:ed|ing)?/i, label: "Lengthening" },
  { re: /collect(?:ion|ing)?/i, label: "Collection" },
  { re: /long.?and.?low|stretch/i, label: "Stretch work" },
  { re: /\bcanter\b/i, label: "Canter work" },
  { re: /\btrot\b/i, label: "Trot work" },
  { re: /\bwalk\b/i, label: "Walk work" },
  { re: /\bhalt\b/i, label: "Halt work" },
  { re: /circle/i, label: "Circles" },
  { re: /straight(?:ness|en)?/i, label: "Straightness" },
  { re: /soft(?:er|en)|contact|rein/i, label: "Softer contact" },
  { re: /rhythm|tempo/i, label: "Rhythm" },
  { re: /balance/i, label: "Balance" },
  { re: /suppleness|bend/i, label: "Bend & suppleness" },
];

export function formatOffset(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Thin End stub — Claude polish owns the real coach card.
 * Do not invent “important” cues from first long trainer lines.
 */
export function pendingCaptureBrief(opts?: {
  horseFocus?: string | null;
  horseName?: string | null;
  startedAt?: Date | string | null;
  hasSpeech?: boolean;
}): CaptureBrief {
  const title = deriveLessonTitle({
    corpus: "",
    horseFocus: opts?.horseFocus,
    horseName: opts?.horseName,
    startedAt: opts?.startedAt,
    hasSpeech: opts?.hasSpeech,
  });
  return {
    title,
    focus: "Writing your lesson brief…",
    summary: [
      "<<<brief_pending>>>",
      "Vector is writing your lesson brief from this ride’s transcript — cleaning the wording, then the coach card.",
      "<<<end_brief_pending>>>",
    ].join("\n"),
    homework: "",
    exercises: "",
    keyPhrases: [],
    cues: [],
  };
}

/**
 * Heuristic lesson brief from transcript.
 * @deprecated Prefer pendingCaptureBrief at End + Claude polish for the real journal.
 */
export function summarizeCaptureTranscript(
  segments: TranscriptSeg[],
  opts?: {
    horseFocus?: string | null;
    trainerName?: string | null;
    horseName?: string | null;
    startedAt?: Date | string | null;
  }
): CaptureBrief {
  // Keep a minimal offline fallback if polish never runs
  if (segments.length === 0) {
    return pendingCaptureBrief({
      horseFocus: opts?.horseFocus,
      horseName: opts?.horseName,
      startedAt: opts?.startedAt,
      hasSpeech: false,
    });
  }

  const trainer = segments.filter(
    (s) => s.speaker === "trainer" && s.text.trim()
  );
  const trainerTexts = trainer.map((s) => s.text.trim());
  const exerciseHints = trainerTexts.filter((t) => EXERCISE_RE.test(t));
  const uniqueExercises = Array.from(
    new Set(exerciseHints.map((t) => t.slice(0, 90)))
  ).slice(0, 6);

  const title = deriveLessonTitle({
    corpus: trainerTexts.join("\n"),
    horseFocus: opts?.horseFocus,
    horseName: opts?.horseName,
    startedAt: opts?.startedAt,
    hasSpeech: segments.length > 0,
  });

  const focus =
    opts?.horseFocus?.trim() ||
    uniqueExercises[0] ||
    "Lesson captured — open Timeline for cues";

  return {
    title,
    focus: clip(focus, 160),
    summary:
      "Transcript saved. Vector could not polish this brief automatically — review the timeline alongside your trainer.",
    homework: opts?.horseFocus
      ? `Carry today’s focus (“${clip(opts.horseFocus, 60)}”) into your next ride — alongside your trainer.`
      : "Pick one cue from the timeline to carry into your next ride — alongside your trainer.",
    exercises: uniqueExercises.join("\n"),
    keyPhrases: [],
    cues: [],
  };
}

/**
 * Short creative list title from lesson themes (not “Capture lesson · datetime”).
 */
export function deriveLessonTitle(opts: {
  corpus: string;
  horseFocus?: string | null;
  horseName?: string | null;
  startedAt?: Date | string | null;
  hasSpeech?: boolean;
}): string {
  const themes = themesFromText(opts.corpus);
  if (themes.length >= 2) return clip(`${themes[0]} & ${themes[1]}`, 60);
  if (themes.length === 1) return themes[0];

  const focusTitle = titleFromFocus(opts.horseFocus);
  if (focusTitle) return focusTitle;

  const horse = opts.horseName?.trim();
  const when = daypartLabel(opts.startedAt);
  if (horse && horse.toLowerCase() !== "horse") {
    return clip(`${when} with ${horse}`, 60);
  }
  if (opts.hasSpeech) return `${when} schooling`;
  return `${when} lesson`;
}

function themesFromText(corpus: string): string[] {
  if (!corpus.trim()) return [];
  const found: string[] = [];
  for (const { re, label } of THEME_PATTERNS) {
    if (!re.test(corpus) || found.includes(label)) continue;
    // Skip generic gait if a more specific same-gait theme already matched
    if (
      (label === "Canter work" && found.some((t) => /canter/i.test(t))) ||
      (label === "Trot work" && found.some((t) => /trot/i.test(t))) ||
      (label === "Walk work" && found.some((t) => /walk/i.test(t)))
    ) {
      continue;
    }
    found.push(label);
    if (found.length >= 2) break;
  }
  return found;
}

function titleFromFocus(focus?: string | null): string | null {
  const raw = focus?.trim();
  if (!raw || raw.length < 4) return null;
  // Drop leading filler; keep a compact phrase
  let t = raw
    .replace(/^(today'?s?\s+)?(focus|goal|work)\s*[:\-–—]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 4) return null;
  // Prefer first clause; keep trainer/rider wording, just capitalize the start
  const cut = t.split(/[.;\n]/)[0]?.trim() || t;
  const phrase = clip(cut, 48);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function daypartLabel(startedAt?: Date | string | null): string {
  const d =
    startedAt instanceof Date
      ? startedAt
      : startedAt
        ? new Date(startedAt)
        : new Date();
  if (Number.isNaN(d.getTime())) return "Schooling";
  const h = hourInHomeTz(d);
  if (h < 11) return "Morning schooling";
  if (h < 15) return "Midday schooling";
  if (h < 19) return "Afternoon schooling";
  return "Evening schooling";
}

function clip(s: string, n: number) {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

/** Build cue reel from featured corrections only when callers need a fallback. */
export function cueReelFromSegments(
  segments: { speaker: string; text: string; offset_ms: number }[],
  limit = 12
): CueReelItem[] {
  return segments
    .filter((s) => s.speaker === "trainer" && s.text.trim().length > 10)
    .slice(0, limit)
    .map((s) => ({
      offset_ms: s.offset_ms,
      text: s.text.trim(),
      speaker: "trainer" as const,
    }));
}
