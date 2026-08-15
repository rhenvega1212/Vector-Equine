/**
 * Brief 14 corpus chokepoint.
 *
 * Every polish / attribution / KB consumer MUST read through
 * `fetchTrainerCorpusSegments`. Do not select `session_transcript_segments`
 * for trainer method extraction — that path can return `vector` rows and
 * silently poison the corpus.
 */

export type CorpusSegment = {
  id: string;
  speaker: string;
  text: string;
  offset_ms: number;
  raw_json: Record<string, unknown> | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryClient = { from: (table: string) => any };

/**
 * Returns transcript rows safe for trainer corpus / polish.
 * Prefers the `trainer_corpus_segments` view (structurally excludes vector).
 */
export async function fetchTrainerCorpusSegments(
  db: QueryClient,
  captureSessionId: string
): Promise<{ data: CorpusSegment[]; error: string | null }> {
  const viaView = await db
    .from("trainer_corpus_segments")
    .select("id, speaker, text, offset_ms, raw_json")
    .eq("capture_session_id", captureSessionId)
    .order("offset_ms", { ascending: true });

  if (!viaView.error) {
    const rows = ((viaView.data || []) as CorpusSegment[]).filter(
      (s) => s.speaker !== "vector"
    );
    return { data: rows, error: null };
  }

  // Migration not applied yet — filter on base table.
  const viaBase = await db
    .from("session_transcript_segments")
    .select("id, speaker, text, offset_ms, raw_json")
    .eq("capture_session_id", captureSessionId)
    .neq("speaker", "vector")
    .order("offset_ms", { ascending: true });

  if (viaBase.error) {
    return { data: [], error: viaBase.error.message as string };
  }

  const rows = ((viaBase.data || []) as CorpusSegment[]).filter(
    (s) => s.speaker !== "vector"
  );
  return { data: rows, error: null };
}

/** Prove chokepoint: must always be 0 for a healthy corpus read. */
export function countVectorLeak(segments: { speaker: string }[]): number {
  return segments.filter((s) => s.speaker === "vector").length;
}
