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

const KEEP_RE =
  /good|nice|better|yes|that'?s it|well done|perfect|softer|steady|lovely/i;

const WATCH_RE =
  /don'?t|too (much|soon|late|heavy|strong)|watch|careful|again|more|less|wait|inside|outside|straight/i;

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
 * Heuristic lesson brief from transcript.
 * Vector prose can rewrite later when Claude is configured; this always returns a readable skeleton.
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
  const trainer = segments.filter(
    (s) => s.speaker === "trainer" && s.text.trim()
  );
  const rider = segments.filter((s) => s.speaker === "rider" && s.text.trim());

  const trainerTexts = trainer.map((s) => s.text.trim());
  const keyPhrases = trainerTexts
    .filter((t) => t.length > 12 && t.length < 140)
    .slice(0, 10);

  const cues: CueReelItem[] = trainer
    .filter((s) => {
      const t = s.text.trim();
      return t.length > 10 && t.length < 160;
    })
    .slice(0, 12)
    .map((s) => ({
      offset_ms: s.offset_ms,
      text: s.text.trim(),
      speaker: "trainer" as const,
    }));

  const exerciseHints = trainerTexts.filter((t) => EXERCISE_RE.test(t));
  const uniqueExercises = Array.from(
    new Set(exerciseHints.map((t) => t.slice(0, 90)))
  ).slice(0, 6);

  const focus =
    opts?.horseFocus?.trim() ||
    keyPhrases[0] ||
    (trainerTexts.length > 0
      ? "Work from today’s coaching cues"
      : "Review the timeline and add your notes");

  const thirds = splitByTime(segments);
  const storyParts: string[] = [];

  if (segments.length === 0) {
    storyParts.push(
      "This lesson was captured without speech on the timeline yet. Add notes after you review — alongside your trainer."
    );
  } else {
    if (thirds.early.length) {
      const open = firstUseful(thirds.early) || keyPhrases[0];
      storyParts.push(
        open
          ? `Opening: coaching steered toward “${clip(open, 100)}.”`
          : "The lesson opened with warm-up and settling into the work."
      );
    }
    if (thirds.mid.length || uniqueExercises.length) {
      const work =
        uniqueExercises.slice(0, 3).join("; ") ||
        firstUseful(thirds.mid) ||
        "main schooling themes";
      storyParts.push(`Main work centered on ${work}.`);
    }
    const keep = trainerTexts.find((t) => KEEP_RE.test(t));
    const watch = trainerTexts.find((t) => WATCH_RE.test(t));
    if (keep || watch) {
      const bits = [
        keep ? `Keep: “${clip(keep, 80)}.”` : null,
        watch ? `Watch: “${clip(watch, 80)}.”` : null,
      ].filter(Boolean);
      storyParts.push(bits.join(" "));
    }
    if (rider.length > 0) {
      storyParts.push(
        `You contributed ${rider.length} moment${rider.length === 1 ? "" : "s"} on the timeline alongside ${
          opts?.trainerName?.trim() || "your trainer"
        }.`
      );
    }
    storyParts.push(
      `Session logged ${segments.length} transcript moment${
        segments.length === 1 ? "" : "s"
      } — see the cue reel and full timeline for detail.`
    );
  }

  const homework =
    uniqueExercises[0] ||
    keyPhrases.find((t) => WATCH_RE.test(t) || EXERCISE_RE.test(t)) ||
    keyPhrases[0] ||
    (opts?.horseFocus
      ? `Carry today’s focus (“${clip(opts.horseFocus, 60)}”) into your next ride — alongside your trainer.`
      : "Carry one cue from today’s lesson into your next ride — alongside your trainer.");

  const exercises =
    uniqueExercises.length > 0
      ? uniqueExercises.join("\n")
      : keyPhrases.slice(0, 4).join("\n") || "See timeline for cues";

  const title = deriveLessonTitle({
    corpus: trainerTexts.join("\n"),
    horseFocus: opts?.horseFocus,
    horseName: opts?.horseName,
    startedAt: opts?.startedAt,
    hasSpeech: segments.length > 0,
  });

  return {
    title,
    focus: clip(focus, 160),
    summary: storyParts.join("\n\n"),
    homework: clip(homework, 400),
    exercises,
    keyPhrases,
    cues,
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
  const h = d.getHours();
  if (h < 11) return "Morning schooling";
  if (h < 15) return "Midday schooling";
  if (h < 19) return "Afternoon schooling";
  return "Evening schooling";
}

function clip(s: string, n: number) {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function firstUseful(segs: TranscriptSeg[]) {
  const line = segs.find(
    (s) => s.speaker === "trainer" && s.text.trim().length > 12
  );
  return line?.text.trim() || null;
}

function splitByTime(segments: TranscriptSeg[]) {
  if (segments.length === 0) {
    return { early: [] as TranscriptSeg[], mid: [] as TranscriptSeg[], late: [] as TranscriptSeg[] };
  }
  const max = Math.max(...segments.map((s) => s.offset_ms), 1);
  const a = max / 3;
  const b = (2 * max) / 3;
  return {
    early: segments.filter((s) => s.offset_ms < a),
    mid: segments.filter((s) => s.offset_ms >= a && s.offset_ms < b),
    late: segments.filter((s) => s.offset_ms >= b),
  };
}

/** Build cue reel from stored timeline (preferred over stale end-of-lesson snapshot). */
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
