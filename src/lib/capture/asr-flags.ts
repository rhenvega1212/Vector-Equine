/**
 * Flagging replaces deletion.
 *
 * Whisper's per-segment quality numbers and the hallucination rules used to
 * drop segments before they were ever stored, which meant a false positive was
 * indistinguishable from silence. Nothing here removes text: it decides whether
 * a row is kept out of the corpus and records which rule decided, so the rule
 * can be audited against what it actually removed.
 */

import { classifyHallucination } from "@/lib/capture/asr-cleanup";

/** Above this, Whisper thinks the audio is not speech. */
export const NO_SPEECH_PROB_MAX = 0.35;
/** Below this, the decode is low-confidence guesswork. */
export const AVG_LOGPROB_MIN = -0.85;
/** Above this, output is repetitive — the classic looping hallucination. */
export const COMPRESSION_RATIO_MAX = 2.2;

/** The three signals Whisper reports per segment. VAD lives in provenance. */
export type QualitySignals = {
  no_speech_prob: number | null;
  avg_logprob: number | null;
  compression_ratio: number | null;
};

export type SegmentFlag = {
  excluded: boolean;
  /** Rule that fired, or null when the row is clean. */
  reason: string | null;
};

export function emptyQualitySignals(): QualitySignals {
  return {
    no_speech_prob: null,
    avg_logprob: null,
    compression_ratio: null,
  };
}

export function readQualitySignals(s: {
  no_speech_prob?: number | null;
  avg_logprob?: number | null;
  compression_ratio?: number | null;
}): QualitySignals {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    no_speech_prob: num(s.no_speech_prob),
    avg_logprob: num(s.avg_logprob),
    compression_ratio: num(s.compression_ratio),
  };
}

/**
 * Decide whether a segment is corpus-eligible. Quality thresholds are checked
 * before text rules so the reason names the cheapest explanation.
 */
export function flagSegment(
  rawText: string,
  quality: QualitySignals = emptyQualitySignals()
): SegmentFlag {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return { excluded: true, reason: "empty" };

  if (
    quality.no_speech_prob !== null &&
    quality.no_speech_prob > NO_SPEECH_PROB_MAX
  ) {
    return { excluded: true, reason: "no_speech_prob" };
  }
  if (quality.avg_logprob !== null && quality.avg_logprob < AVG_LOGPROB_MIN) {
    return { excluded: true, reason: "avg_logprob" };
  }
  if (
    quality.compression_ratio !== null &&
    quality.compression_ratio > COMPRESSION_RATIO_MAX
  ) {
    return { excluded: true, reason: "compression_ratio" };
  }

  const rule = classifyHallucination(text);
  if (rule) return { excluded: true, reason: `hallucination:${rule}` };

  return { excluded: false, reason: null };
}
