/**
 * Brief 14 corpus chokepoint.
 *
 * Every polish / attribution / KB consumer MUST read through
 * `fetchTrainerCorpusSegments`. Do not select `session_transcript_segments`
 * for trainer method extraction — that path can return `vector` rows and
 * silently poison the corpus.
 *
 * The variant is a required argument, not a default. Corpus and ground-truth
 * work wants `raw`; anything a person reads or a model is given wants
 * `cleaned`. See transcript-read for why there is no fallback between them.
 *
 * Flagged rows never appear in either variant here — a consumer that got them
 * would train on hallucinations. The `trainer_corpus_segments` view enforces
 * the same two exclusions for SQL-side consumers.
 */

import {
  readCleanedTranscript,
  readRawTranscript,
  type TranscriptClient,
} from "@/lib/capture/transcript-read";

export type CorpusSegment = {
  id: string;
  speaker: string;
  text: string;
  offset_ms: number;
  raw_json: Record<string, unknown> | null;
};

/** Returns transcript rows safe for trainer corpus / polish. */
export async function fetchTrainerCorpusSegments(
  db: TranscriptClient,
  captureSessionId: string,
  variant: "raw" | "cleaned"
): Promise<{ data: CorpusSegment[]; error: string | null }> {
  const read =
    variant === "raw"
      ? await readRawTranscript(db, captureSessionId, {
          includeVector: false,
          includeFlagged: false,
        })
      : await readCleanedTranscript(db, captureSessionId, {
          includeVector: false,
        });

  if (read.error) return { data: [], error: read.error };

  return {
    data: read.data.map((s) => ({
      id: s.id,
      speaker: s.speaker,
      text: s.text,
      offset_ms: s.offset_ms,
      raw_json: s.raw_json,
    })),
    error: null,
  };
}

/** Prove chokepoint: must always be 0 for a healthy corpus read. */
export function countVectorLeak(segments: { speaker: string }[]): number {
  return segments.filter((s) => s.speaker === "vector").length;
}
