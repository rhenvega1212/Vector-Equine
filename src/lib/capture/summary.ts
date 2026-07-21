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
  opts?: { horseFocus?: string | null; trainerName?: string | null }
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

  return {
    focus: clip(focus, 160),
    summary: storyParts.join("\n\n"),
    homework: clip(homework, 400),
    exercises,
    keyPhrases,
    cues,
  };
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
