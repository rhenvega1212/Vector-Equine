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
  summary: string;
  homework: string;
  exercises: string;
  /** Valuable trainer lines to show as direct quotes in the journal. */
  quotes: CoachQuote[];
};

export type TranscriptCleanupResult = {
  cleaned: CleanupSegIn[];
  brief: CleanupBrief | null;
  usedClaude: boolean;
};

const briefSchema = z.object({
  title: z
    .string()
    .max(80)
    .describe("Short creative lesson theme title, not a datetime stamp"),
  focus: z
    .string()
    .max(200)
    .describe("One sentence for Today's focus"),
  summary: z
    .string()
    .max(2500)
    .describe(
      "Lesson story in 2–4 short paragraphs separated by blank lines. Calm coach voice as Vector. Weave in 1–2 short trainer quotes in quotation marks when they matter. No medical diagnoses."
    ),
  homework: z
    .string()
    .max(500)
    .describe("One concrete next-ride carryover alongside their trainer"),
  exercises: z
    .string()
    .max(800)
    .describe("Key work / patterns, one per line"),
  quotes: z
    .array(
      z.object({
        i: z
          .number()
          .int()
          .min(0)
          .describe("Index of the trainer line in the input transcript"),
        text: z
          .string()
          .max(400)
          .describe("Cleaned quote text without surrounding quotation marks"),
      })
    )
    .max(6)
    .describe(
      "3–6 most valuable trainer cues for the journal quote reel. Prefer coaching corrections and keep-going moments. Only from trainer lines. Empty if none."
    ),
  segments: z
    .array(
      z.object({
        i: z.number().int().min(0),
        text: z.string().max(4000),
      })
    )
    .describe(
      "Corrected transcript lines. Same count/order as input (use index i). Fix ASR only — do not invent speech."
    ),
});

/**
 * Clean ASR noise and write a Vector-voiced brief for the journal.
 * Falls back gracefully when Claude is missing or the call fails.
 */
export async function cleanupTranscriptForJournal(
  segments: CleanupSegIn[],
  opts: {
    horseName?: string | null;
    horseFocus?: string | null;
    trainerName?: string | null;
  }
): Promise<TranscriptCleanupResult> {
  if (segments.length === 0) {
    return { cleaned: [], brief: null, usedClaude: false };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { cleaned: segments, brief: null, usedClaude: false };
  }

  const capped = segments.slice(0, 100);
  const lines = capped
    .map(
      (s, i) =>
        `${i}|${s.speaker}|${formatOffset(s.offset_ms)}|${s.text.trim()}`
    )
    .join("\n");

  try {
    const anthropic = createAnthropic({ apiKey });
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-5"),
      schema: briefSchema,
      temperature: 0.2,
      system: `You are Vector — a calm equestrian coaching voice cleaning a lesson capture for the rider's journal.

TASK
1) Fix speech-to-text errors in each transcript line (equestrian terms, garbled words, punctuation). Keep meaning. Do NOT invent cues, scores, sensors, or medical diagnoses.
2) Write a clear lesson brief from the cleaned conversation for the journal write-up.
3) Pick the most valuable trainer quotes for a quote reel (direct coach wording).

RULES
- Return one corrected text per input index i (0..n-1). Same speakers/order; only change text.
- If a line is already fine, return it unchanged.
- quotes[].i must point at trainer lines only. Use cleaned wording. Do not invent quotes.
- In the story, put the best trainer lines in quotation marks when they carry the lesson.
- Brief must be grounded in the transcript. If evidence is thin, say so plainly.
- Never say you are an AI.
- Voice: practical, warm, alongside their trainer.`,
      prompt: `Horse: ${opts.horseName || "Horse"}
Horse focus: ${opts.horseFocus || "not set"}
Trainer: ${opts.trainerName || "not recorded"}

RAW TRANSCRIPT (index|speaker|mm:ss|text):
${lines}`,
    });

    const byIndex = new Map(object.segments.map((s) => [s.i, s.text.trim()]));
    const featuredIndexes = new Set(
      object.quotes
        .map((q) => q.i)
        .filter((i) => capped[i]?.speaker === "trainer")
    );

    const cleaned = segments.map((s, i) => {
      if (i >= capped.length) return s;
      const next = byIndex.get(i);
      const text = next && next.length > 0 ? next : s.text;
      const changed = text.trim() !== s.text.trim();
      const featured = featuredIndexes.has(i);
      if (!changed && !featured) return s;
      return {
        ...s,
        text,
        raw_json: {
          ...(s.raw_json || {}),
          ...(changed ? { asr_text: s.text, cleaned: true } : {}),
          ...(featured ? { featured_quote: true } : {}),
        },
      };
    });

    const quotes: CoachQuote[] = object.quotes
      .filter((q) => capped[q.i]?.speaker === "trainer")
      .map((q) => ({
        offset_ms: capped[q.i].offset_ms,
        text: (q.text || byIndex.get(q.i) || capped[q.i].text).trim(),
      }))
      .filter((q) => q.text.length > 0)
      .slice(0, 6);

    const brief: CleanupBrief = {
      title: object.title.trim().slice(0, 80),
      focus: object.focus.trim().slice(0, 200),
      summary: object.summary.trim(),
      homework: object.homework.trim().slice(0, 500),
      exercises: object.exercises.trim(),
      quotes,
    };

    return { cleaned, brief, usedClaude: true };
  } catch (e) {
    console.error("transcript cleanup failed", e);
    return { cleaned: segments, brief: null, usedClaude: false };
  }
}

/** Markers so we can replace the rider-highlights block without wiping the rest of the brief. */
export const RIDER_HIGHLIGHTS_START = "<<<rider_highlights>>>";
export const RIDER_HIGHLIGHTS_END = "<<<end_rider_highlights>>>";

export function stripRiderHighlightsBlock(summary: string | null | undefined): string {
  if (!summary) return "";
  const re = new RegExp(
    `${RIDER_HIGHLIGHTS_START}[\\s\\S]*?${RIDER_HIGHLIGHTS_END}\\s*`,
    "g"
  );
  return summary.replace(re, "").trim();
}

export function buildRiderHighlightsBlock(
  items: { offset_ms: number; speaker: string; text: string; trainerName?: string | null }[]
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
  items: { offset_ms: number; speaker: string; text: string; trainerName?: string | null }[]
): string {
  const base = stripRiderHighlightsBlock(summary);
  const block = buildRiderHighlightsBlock(items);
  if (!block) return base;
  return base ? `${base}\n\n${block}` : block;
}
