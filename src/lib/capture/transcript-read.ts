/**
 * The invariant this module exists to hold:
 *
 *   Storage is raw. Display is cleaned. The two are never the same operation,
 *   and no display concern ever justifies changing what is stored.
 *
 * There is no default reader. A new consumer has to say which variant it wants,
 * because the difference between reading raw by design and reading raw by
 * accident is the difference between a ground-truth artifact and a bug.
 *
 *   readRawTranscript     — verbatim ASR, flagged rows included. Ground truth,
 *                           audits, corpus construction, hand-correction.
 *   readCleanedTranscript — display text, flagged rows removed. Anything a
 *                           person reads or a model is given.
 */

import { displayTranscriptText } from "@/lib/capture/asr-cleanup";

export type TranscriptRow = {
  id: string;
  speaker: string;
  text: string;
  offset_ms: number;
  ended_offset_ms: number | null;
  confidence: number | null;
  raw_json: Record<string, unknown> | null;
  /** Rule that flagged this row, null when clean. Always null on a cleaned read. */
  flag_reason: string | null;
};

export type TranscriptRead = {
  data: TranscriptRow[];
  error: string | null;
  variant: "raw" | "cleaned";
};

export type ReadOptions = {
  /** Vector's own spoken lines. Excluded for corpus and trainer-method reads. */
  includeVector?: boolean;
  /**
   * Rows a rule flagged. Defaults to true on a raw read (the audit) and false
   * on a cleaned / display read. Corpus readers pass this explicitly.
   */
  includeFlagged?: boolean;
  limit?: number;
};

/**
 * Server, admin and route-handler Supabase clients all work here. Their
 * builder generics differ enough that a structural type costs more than it
 * catches.
 */
export type TranscriptClient = { from: (table: string) => any };

const COLS =
  "id, offset_ms, ended_offset_ms, speaker, text, text_cleaned, confidence, raw_json, flag_reason, excluded_from_corpus";
const LEGACY_COLS =
  "id, offset_ms, ended_offset_ms, speaker, text, confidence, raw_json, excluded_from_corpus";

type RawRow = {
  id: string;
  offset_ms: number;
  ended_offset_ms: number | null;
  speaker: string;
  text: string;
  text_cleaned?: string | null;
  confidence: number | null;
  raw_json: Record<string, unknown> | null;
  flag_reason?: string | null;
  excluded_from_corpus?: boolean | null;
};

async function fetchRows(
  db: TranscriptClient,
  captureSessionId: string,
  opts: ReadOptions
): Promise<{ rows: RawRow[]; error: string | null }> {
  const build = (cols: string) => {
    let q = db
      .from("session_transcript_segments")
      .select(cols)
      .eq("capture_session_id", captureSessionId)
      .order("offset_ms", { ascending: true });
    if (opts.includeVector === false) q = q.neq("speaker", "vector");
    if (opts.limit) q = q.limit(opts.limit);
    return q;
  };

  const res = await build(COLS);
  if (!res.error) return { rows: (res.data || []) as RawRow[], error: null };

  // Migration not applied yet. Cleaned reads fall back to cleaning at read
  // time, which is what they do for pre-migration rows anyway.
  if (/text_cleaned|flag_reason/i.test(res.error.message as string)) {
    const legacy = await build(LEGACY_COLS);
    if (legacy.error) {
      return { rows: [], error: legacy.error.message as string };
    }
    return { rows: (legacy.data || []) as RawRow[], error: null };
  }

  return { rows: [], error: res.error.message as string };
}

function flagOf(row: RawRow): string | null {
  if (typeof row.flag_reason === "string" && row.flag_reason) {
    return row.flag_reason;
  }
  const reason = (row.raw_json as { exclusion_reason?: unknown } | null)
    ?.exclusion_reason;
  return typeof reason === "string" && reason ? reason : null;
}

/**
 * Verbatim ASR output, exactly as stored, including rows a rule flagged.
 * Never show this to a rider — it contains "Thanks for watching".
 */
export async function readRawTranscript(
  db: TranscriptClient,
  captureSessionId: string,
  opts: ReadOptions = {}
): Promise<TranscriptRead> {
  const { rows, error } = await fetchRows(db, captureSessionId, opts);
  if (error) return { data: [], error, variant: "raw" };

  // Corpus reads check the column as well as the rule. A row can be excluded
  // without a rule having fired, and a consumer that only checked the rule
  // would train on it.
  const keep = (r: RawRow) =>
    opts.includeFlagged !== false ||
    (!flagOf(r) && r.excluded_from_corpus !== true);

  return {
    data: rows
      .filter(keep)
      .map((r) => ({
        id: r.id,
        speaker: r.speaker,
        text: r.text,
        offset_ms: r.offset_ms,
        ended_offset_ms: r.ended_offset_ms,
        confidence: r.confidence,
        raw_json: r.raw_json,
        flag_reason: flagOf(r),
      })),
    error: null,
    variant: "raw",
  };
}

/**
 * Display wording. Flagged rows are hidden unless `includeFlagged` is true.
 * Cleanup never blanks a line — an empty stored `text` is the only skip.
 */
export async function readCleanedTranscript(
  db: TranscriptClient,
  captureSessionId: string,
  opts: ReadOptions = {}
): Promise<TranscriptRead> {
  const { rows, error } = await fetchRows(db, captureSessionId, opts);
  if (error) return { data: [], error, variant: "cleaned" };

  const includeFlagged = opts.includeFlagged === true;
  const data: TranscriptRow[] = [];
  for (const r of rows) {
    // Filters on the rule, not on excluded_from_corpus: Vector's own lines are
    // excluded from the corpus by design and still belong on screen.
    if (flagOf(r) && !includeFlagged) continue;
    const text = displayTranscriptText(r.text, r.text_cleaned);
    if (!text) continue;
    data.push({
      id: r.id,
      speaker: r.speaker,
      text,
      offset_ms: r.offset_ms,
      ended_offset_ms: r.ended_offset_ms,
      confidence: r.confidence,
      raw_json: r.raw_json,
      flag_reason: includeFlagged ? flagOf(r) : null,
    });
  }

  return { data, error: null, variant: "cleaned" };
}
