import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { formatOffset, type TranscriptSeg } from "@/lib/capture/summary";

export type CleanupSegIn = TranscriptSeg & {
  id?: string;
  raw_json?: Record<string, unknown> | null;
};

export type CoachQuote = {
  offset_ms: number;
  text: string;
};

export type CleanupBrief = {
  title: string;
  focus: string;
  /** Short optional narrative (0–2 paragraphs). */
  summary: string;
  homework: string;
  exercises: string;
  /** Corrections that mattered — drives featured quotes + coach card. */
  corrections: CoachQuote[];
  /** What improved — keep-going moments only. */
  keeps: CoachQuote[];
  /** @deprecated Prefer corrections; kept for callers that still read quotes. */
  quotes: CoachQuote[];
};

export type TranscriptCleanupResult = {
  cleaned: CleanupSegIn[];
  brief: CleanupBrief | null;
  usedClaude: boolean;
};

/** Markers for structured coach-card blocks inside training_sessions.summary */
export const BRIEF_PENDING_START = "<<<brief_pending>>>";
export const BRIEF_PENDING_END = "<<<end_brief_pending>>>";
export const CORRECTIONS_START = "<<<corrections>>>";
export const CORRECTIONS_END = "<<<end_corrections>>>";
export const KEEPS_START = "<<<keeps>>>";
export const KEEPS_END = "<<<end_keeps>>>";
export const RIDER_HIGHLIGHTS_START = "<<<rider_highlights>>>";
export const RIDER_HIGHLIGHTS_END = "<<<end_rider_highlights>>>";

const coachCardSchema = z.object({
  title: z
    .string()
    .max(80)
    .describe(
      "North-star phrase for Vector home THE WORK (serif line): the quality or intent, complete and sparse — e.g. \"Forward from inside leg\" or \"Canter pirouettes\". 3–8 words. Not a paragraph, not a comma list of everything."
    ),
  theme: z
    .string()
    .max(200)
    .describe(
      "One sentence for the debrief card: what this lesson was about. May be longer than title."
    ),
  corrections: z
    .array(
      z.object({
        i: z
          .number()
          .int()
          .min(0)
          .describe("Index of a trainer line in the input transcript"),
        text: z
          .string()
          .max(400)
          .describe(
            "Cleaned correction cue (fix ASR lightly) without surrounding quotes"
          ),
      })
    )
    .max(3)
    .describe(
      "2–3 coaching corrections that mattered. Empty if none. Never filler praise."
    ),
  keeps: z
    .array(
      z.object({
        i: z.number().int().min(0),
        text: z.string().max(400),
      })
    )
    .max(2)
    .describe(
      "0–2 keep-going moments only when the trainer clearly marks improvement. Empty if none."
    ),
  story: z
    .string()
    .max(1200)
    .describe(
      "Optional 1–2 short paragraphs as Vector. Grounded only in the transcript. Empty string if thin evidence."
    ),
  homework: z
    .string()
    .max(220)
    .describe(
      "One next-ride instruction for the home gold-italic line — a clear exercise or warm-up (one sentence). e.g. \"Next ride, warm up with that inside bend-and-leg tool.\" Alongside their trainer."
    ),
  exercises: z
    .string()
    .max(800)
    .describe("Key exercises / patterns, one per line — not raw chatter"),
});

const FILLER_RE =
  /^(yeah|yep|ok|okay|right|uh|um|hmm|good|nice|yes|alright|all right)[.!?]*$/i;
const CORRECTION_HINT_RE =
  /don'?t|too (much|soon|late|heavy|strong|soft)|watch|careful|again|more|less|wait|softer|inside|outside|straight|bend|half.?halt|release|sit|leg|rein|tempo|rhythm|balance|collect|lengthen|transition/i;

/**
 * Prefer corrective / substantive lines when the lesson is long.
 * Returns a contiguous-index list for the model; map back via `originalIndex`.
 */
function selectSegmentsForModel(
  segments: CleanupSegIn[],
  max = 70
): { seg: CleanupSegIn; originalIndex: number }[] {
  if (segments.length <= max) {
    return segments.map((seg, originalIndex) => ({ seg, originalIndex }));
  }

  const n = segments.length;
  const scored = segments.map((seg, originalIndex) => {
    const text = seg.text.trim();
    let score = Math.min(text.length, 120) / 40;
    if (seg.speaker === "trainer") score += 2;
    if (CORRECTION_HINT_RE.test(text)) score += 4;
    if (FILLER_RE.test(text) || text.length < 8) score -= 5;
    // Prefer mid/late lesson over warm-up chatter
    const frac = originalIndex / Math.max(n - 1, 1);
    if (frac < 0.12) score -= 1.5;
    else if (frac > 0.25) score += 1;
    return { seg, originalIndex, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const keep = new Set<number>();
  for (const row of scored) {
    if (keep.size >= max) break;
    keep.add(row.originalIndex);
  }
  // Anchor start/end for lesson shape
  for (let i = 0; i < Math.min(4, n); i++) keep.add(i);
  for (let i = Math.max(0, n - 8); i < n; i++) keep.add(i);

  const indices = Array.from(keep).sort((a, b) => a - b);
  // If over max after anchors, drop lowest-scoring mid lines
  if (indices.length > max) {
    const mid = indices.filter((i) => i >= 4 && i < n - 8);
    const midScored = mid
      .map((i) => ({ i, score: scored.find((s) => s.originalIndex === i)?.score ?? 0 }))
      .sort((a, b) => a.score - b.score);
    const drop = indices.length - max;
    const dropSet = new Set(midScored.slice(0, drop).map((d) => d.i));
    return indices
      .filter((i) => !dropSet.has(i))
      .map((originalIndex) => ({ seg: segments[originalIndex], originalIndex }));
  }

  return indices.map((originalIndex) => ({
    seg: segments[originalIndex],
    originalIndex,
  }));
}

export function buildPendingBriefSummary(): string {
  return [
    BRIEF_PENDING_START,
    "Vector is writing your lesson brief from this ride’s transcript — cleaning the wording, then the coach card.",
    BRIEF_PENDING_END,
  ].join("\n");
}

export function isBriefPending(summary: string | null | undefined): boolean {
  return !!summary && summary.includes(BRIEF_PENDING_START);
}

export function buildCoachCardSummary(opts: {
  focus: string;
  story?: string;
  corrections: CoachQuote[];
  keeps: CoachQuote[];
}): string {
  const parts: string[] = [];
  if (opts.focus.trim()) parts.push(opts.focus.trim());

  if (opts.corrections.length > 0) {
    parts.push(
      [
        CORRECTIONS_START,
        ...opts.corrections.map(
          (q) => `“${q.text.trim()}” (${formatOffset(q.offset_ms)})`
        ),
        CORRECTIONS_END,
      ].join("\n")
    );
  }

  if (opts.keeps.length > 0) {
    parts.push(
      [
        KEEPS_START,
        ...opts.keeps.map(
          (q) => `“${q.text.trim()}” (${formatOffset(q.offset_ms)})`
        ),
        KEEPS_END,
      ].join("\n")
    );
  }

  if (opts.story?.trim()) parts.push(opts.story.trim());
  return parts.join("\n\n");
}

export type ParsedCoachCard = {
  pending: boolean;
  focus: string | null;
  story: string | null;
  corrections: { offset_ms: number; text: string }[];
  keeps: { offset_ms: number; text: string }[];
  riderMarks: string | null;
};

function extractMarkedBlock(
  raw: string,
  startMark: string,
  endMark: string
): { body: string; rest: string } | null {
  const start = raw.indexOf(startMark);
  const end = raw.indexOf(endMark);
  if (start === -1 || end === -1 || end < start) return null;
  const body = raw.slice(start + startMark.length, end).trim();
  const rest = `${raw.slice(0, start).trim()}\n\n${raw
    .slice(end + endMark.length)
    .trim()}`.trim();
  return { body, rest };
}

function parseQuotedCueLines(
  block: string
): { offset_ms: number; text: string }[] {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: { offset_ms: number; text: string }[] = [];
  for (const line of lines) {
    const m = line.match(/^[“"](.+?)[”"]\s*\((\d{1,3}):(\d{2})\)/);
    if (!m) continue;
    const mins = parseInt(m[2], 10);
    const secs = parseInt(m[3], 10);
    out.push({
      text: m[1].trim(),
      offset_ms: (mins * 60 + secs) * 1000,
    });
  }
  return out;
}

/** Parse structured coach-card summary (focus + markers). */
export function parseCoachCardSummary(
  summary: string | null | undefined
): ParsedCoachCard {
  if (!summary?.trim()) {
    return {
      pending: false,
      focus: null,
      story: null,
      corrections: [],
      keeps: [],
      riderMarks: null,
    };
  }

  let raw = summary.trim();
  let pending = false;
  let riderMarks: string | null = null;

  const pendingBlock = extractMarkedBlock(
    raw,
    BRIEF_PENDING_START,
    BRIEF_PENDING_END
  );
  if (pendingBlock) {
    pending = true;
    raw = pendingBlock.rest;
  }

  const riderBlock = extractMarkedBlock(
    raw,
    RIDER_HIGHLIGHTS_START,
    RIDER_HIGHLIGHTS_END
  );
  if (riderBlock) {
    riderMarks = riderBlock.body
      .replace(/^What you marked as valuable:\s*/i, "")
      .trim();
    raw = riderBlock.rest;
  }

  let corrections: { offset_ms: number; text: string }[] = [];
  const corrBlock = extractMarkedBlock(raw, CORRECTIONS_START, CORRECTIONS_END);
  if (corrBlock) {
    corrections = parseQuotedCueLines(corrBlock.body);
    raw = corrBlock.rest;
  }

  let keeps: { offset_ms: number; text: string }[] = [];
  const keepBlock = extractMarkedBlock(raw, KEEPS_START, KEEPS_END);
  if (keepBlock) {
    keeps = parseQuotedCueLines(keepBlock.body);
    raw = keepBlock.rest;
  }

  const parts = raw
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let focus: string | null = null;
  let story: string | null = null;
  if (parts.length >= 2 && parts[0].length < 160) {
    focus = parts[0];
    story = parts.slice(1).join("\n\n");
  } else if (parts.length === 1 && parts[0].length < 160 && !corrections.length) {
    focus = parts[0];
  } else if (parts.length > 0) {
    story = parts.join("\n\n");
  }

  return { pending, focus, story, corrections, keeps, riderMarks };
}

/**
 * Write a Vector coach-card brief from the transcript.
 * Marks featured correction/keep lines; does not rewrite the full ASR timeline
 * (that was too slow/fragile on long lessons).
 */
export async function cleanupTranscriptForJournal(
  segments: CleanupSegIn[],
  opts: {
    horseName?: string | null;
    horseFocus?: string | null;
    trainerName?: string | null;
    timeoutMs?: number;
  }
): Promise<TranscriptCleanupResult> {
  if (segments.length === 0) {
    return { cleaned: [], brief: null, usedClaude: false };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { cleaned: segments, brief: null, usedClaude: false };
  }

  const selected = selectSegmentsForModel(segments);
  const lines = selected
    .map(
      ({ seg }, i) =>
        `${i}|${seg.speaker}|${formatOffset(seg.offset_ms)}|${seg.text.trim()}`
    )
    .join("\n");

  try {
    const anthropic = createAnthropic({ apiKey });
    const briefPromise = generateObject({
      model: anthropic("claude-sonnet-4-5"),
      schema: coachCardSchema,
      temperature: 0.15,
      system: `You are Vector — a calm equestrian coaching voice preparing a rider's lesson journal.

TASK
Read the transcript and write a sparse coach card with a clear home-screen pair:
- title: north-star phrase (3–8 words) — the quality or intent for THE WORK serif line (e.g. "Forward from inside leg", "Canter pirouettes"). Complete and sparse. Not a paragraph. Not a long comma list.
- homework: one next-ride instruction (one sentence) for the gold italic — a concrete warm-up or exercise (e.g. "Next ride, warm up with that inside bend-and-leg tool to unlock the body."). Alongside their trainer.
- theme: one sentence for the debrief — what the lesson was about (may be longer than title)
- corrections: 2–3 trainer corrections that truly mattered (prefer repeated / corrective cues)
- keeps: 0–2 clear improvement moments only
- exercises: distinct patterns/work, one per line
- story: optional 1–2 short paragraphs; skip if thin

RULES
- corrections[].i and keeps[].i must be trainer lines only. Clean obvious ASR noise in text. Do not invent.
- Refuse filler: “yeah”, “ok”, “good”, “nice” alone, warm-up chatter, and vague praise are NOT corrections.
- Prefer cues about aids, balance, rhythm, bend, contact, transitions, and specific exercises.
- If evidence is thin, leave corrections/keeps empty and say so plainly in theme or story.
- Never say you are an AI.
- Voice: practical, warm, alongside their trainer.`,
      prompt: `Horse: ${opts.horseName || "Horse"}
Horse focus: ${opts.horseFocus || "not set"}
Trainer: ${opts.trainerName || "not recorded"}

TRANSCRIPT SAMPLE (index|speaker|mm:ss|text):
${lines}`,
    });

    const timed = await Promise.race([
      briefPromise,
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), opts.timeoutMs ?? 60000)
      ),
    ]);

    if (timed === "timeout") {
      console.error("transcript brief timed out");
      return { cleaned: segments, brief: null, usedClaude: false };
    }

    const { object } = timed;

    const modelToOriginal = new Map(
      selected.map((row, i) => [i, row.originalIndex])
    );

    const featuredOriginal = new Set<number>();
    const cleanedTextByOriginal = new Map<number, string>();

    for (const q of [...object.corrections, ...object.keeps]) {
      const orig = modelToOriginal.get(q.i);
      if (orig == null) continue;
      if (segments[orig]?.speaker !== "trainer") continue;
      featuredOriginal.add(orig);
      if (q.text?.trim()) cleanedTextByOriginal.set(orig, q.text.trim());
    }

    const cleaned = segments.map((s, originalIndex) => {
      const featured = featuredOriginal.has(originalIndex);
      const next = cleanedTextByOriginal.get(originalIndex);
      const text = next && next.length > 0 ? next : s.text;
      const changed = text.trim() !== s.text.trim();
      const prevRaw = { ...(s.raw_json || {}) };
      if ("featured_quote" in prevRaw && !featured) {
        delete prevRaw.featured_quote;
      }

      if (!changed && !featured && !("featured_quote" in (s.raw_json || {}))) {
        return s;
      }

      return {
        ...s,
        text,
        raw_json: {
          ...prevRaw,
          ...(changed ? { asr_text: s.text, cleaned: true } : {}),
          ...(featured ? { featured_quote: true } : {}),
        },
      };
    });

    const mapCue = (
      items: { i: number; text: string }[]
    ): CoachQuote[] =>
      items
        .map((q) => {
          const orig = modelToOriginal.get(q.i);
          if (orig == null || segments[orig]?.speaker !== "trainer") return null;
          const text = (
            q.text ||
            cleanedTextByOriginal.get(orig) ||
            segments[orig].text
          ).trim();
          if (!text || FILLER_RE.test(text)) return null;
          return { offset_ms: segments[orig].offset_ms, text };
        })
        .filter((q): q is CoachQuote => !!q);

    const corrections = mapCue(object.corrections).slice(0, 3);
    const keeps = mapCue(object.keeps).slice(0, 2);

    const brief: CleanupBrief = {
      title: object.title.trim().slice(0, 80),
      focus: object.theme.trim().slice(0, 200),
      summary: object.story.trim(),
      homework: object.homework.trim().slice(0, 220),
      exercises: object.exercises.trim(),
      corrections,
      keeps,
      quotes: corrections,
    };

    return { cleaned, brief, usedClaude: true };
  } catch (e) {
    console.error("transcript cleanup failed", e);
    return { cleaned: segments, brief: null, usedClaude: false };
  }
}

export function stripRiderHighlightsBlock(
  summary: string | null | undefined
): string {
  if (!summary) return "";
  const re = new RegExp(
    `${RIDER_HIGHLIGHTS_START}[\\s\\S]*?${RIDER_HIGHLIGHTS_END}\\s*`,
    "g"
  );
  return summary.replace(re, "").trim();
}

export function buildRiderHighlightsBlock(
  items: {
    offset_ms: number;
    speaker: string;
    text: string;
    trainerName?: string | null;
  }[]
): string {
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const who =
      item.speaker === "trainer"
        ? item.trainerName || "trainer"
        : item.speaker === "rider"
          ? "you"
          : item.speaker;
    return `“${item.text.trim()}” (${formatOffset(item.offset_ms)} · ${who})`;
  });
  return [
    RIDER_HIGHLIGHTS_START,
    "What you marked as valuable:",
    "",
    ...lines,
    RIDER_HIGHLIGHTS_END,
  ].join("\n");
}

export function mergeRiderHighlightsIntoSummary(
  summary: string | null | undefined,
  items: {
    offset_ms: number;
    speaker: string;
    text: string;
    trainerName?: string | null;
  }[]
): string {
  const base = stripRiderHighlightsBlock(summary);
  const block = buildRiderHighlightsBlock(items);
  if (!block) return base;
  return base ? `${base}\n\n${block}` : block;
}
