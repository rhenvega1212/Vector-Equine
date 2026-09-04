/**
 * Post-ride capture verification. Conservative on purpose: a session that
 * might be unusable as a measurement baseline is a no, with a named reason.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  measureAudioCoverage,
  type AudioCoverageReport,
} from "@/lib/capture/audio-coverage";
import {
  readCleanedTranscript,
  readRawTranscript,
} from "@/lib/capture/transcript-read";
import { fetchTrainerCorpusSegments } from "@/lib/capture/trainer-corpus";

const MIN_COVERAGE_PCT = 90;
const MAX_GAP_MS = 5000;

/** Named so a missing binary cannot be mistaken for a bad ride. */
export const FFPROBE_MISSING_REASON =
  "ffprobe not found on PATH — cannot read webm duration, so coverage is unknown. This is a tooling problem, not a bad session. Install ffmpeg (`brew install ffmpeg`) and rerun from a terminal where `which ffprobe` prints a path.";

export type SessionVerifyReport = {
  generated_at: string;
  capture_session_id: string;
  training_session_id: string | null;
  is_test: boolean;
  segments: {
    total: number;
    by_speaker: Record<string, number>;
    by_engine: Record<string, number>;
    superseded_pairs: number;
    unique_after_pairs: number;
    flagged: number;
    by_flag_reason: Record<string, number>;
  };
  reads: {
    stored: number;
    raw_including_flagged: number;
    cleaned_display: number;
    corpus_cleaned: number;
    flagged: number;
  };
  audio: AudioCoverageReport;
  provenance: {
    whisper_rows: number;
    complete: number;
    missing: string[];
  };
  quality: {
    whisper_rows: number;
    complete: number;
    missing: string[];
  };
  wording: {
    empty_cleaned: number;
    missing_cleaned: number;
  };
  flags: {
    excluded_without_reason: number;
  };
  verdict: {
    usable_as_baseline: boolean;
    reasons: string[];
  };
};

type StoredRow = {
  id: string;
  speaker: string;
  text: string;
  text_cleaned: string | null;
  offset_ms: number;
  excluded_from_corpus: boolean | null;
  flag_reason: string | null;
  raw_json: Record<string, unknown> | null;
};

function engineOf(row: StoredRow): string {
  const engine = row.raw_json?.engine;
  return typeof engine === "string" && engine ? engine : "unmarked";
}

function flagOf(row: StoredRow): string | null {
  if (row.flag_reason) return row.flag_reason;
  const reason = row.raw_json?.exclusion_reason;
  return typeof reason === "string" && reason ? reason : null;
}

function qualityComplete(row: StoredRow): boolean {
  const q = row.raw_json?.quality;
  if (!q || typeof q !== "object") return false;
  const rec = q as Record<string, unknown>;
  const keys = ["no_speech_prob", "avg_logprob", "compression_ratio"] as const;
  return keys.every((k) => typeof rec[k] === "number" && Number.isFinite(rec[k]));
}

function provenanceComplete(row: StoredRow): boolean {
  const j = row.raw_json;
  if (!j) return false;
  return (
    j.engine === "whisper" &&
    typeof j.model === "string" &&
    Boolean(j.model) &&
    typeof j.prompt_version === "string" &&
    Boolean(j.prompt_version) &&
    "vad" in j &&
    (j.producing_path === "cloud" || j.producing_path === "edge")
  );
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

export async function verifyCaptureSession(
  db: SupabaseClient,
  captureSessionId: string
): Promise<SessionVerifyReport> {
  const { data: capture, error: capErr } = await db
    .from("capture_sessions")
    .select("id, training_session_id, is_test")
    .eq("id", captureSessionId)
    .maybeSingle();

  const reasons: string[] = [];
  if (capErr) reasons.push(`capture lookup failed: ${capErr.message}`);
  if (!capture) reasons.push("capture session not found");

  const { data: rows, error: rowErr } = await db
    .from("session_transcript_segments")
    .select(
      "id, speaker, text, text_cleaned, offset_ms, excluded_from_corpus, flag_reason, raw_json"
    )
    .eq("capture_session_id", captureSessionId)
    .order("offset_ms", { ascending: true });

  if (rowErr) reasons.push(`segment lookup failed: ${rowErr.message}`);

  const stored = (rows || []) as StoredRow[];
  const bySpeaker: Record<string, number> = {};
  const byEngine: Record<string, number> = {};
  const byFlag: Record<string, number> = {};
  let supersededPairs = 0;
  let flagged = 0;
  let emptyCleaned = 0;
  let missingCleaned = 0;
  let excludedWithoutReason = 0;
  let whisperRows = 0;
  let qualityOk = 0;
  let provenanceOk = 0;
  const qualityMissing: string[] = [];
  const provenanceMissing: string[] = [];

  for (const row of stored) {
    bump(bySpeaker, row.speaker);
    bump(byEngine, engineOf(row));
    const reason = flagOf(row);
    if (reason) {
      flagged += 1;
      bump(byFlag, reason);
      if (reason === "superseded_by_whisper") supersededPairs += 1;
    }
    if (row.excluded_from_corpus && !reason && row.speaker !== "vector") {
      excludedWithoutReason += 1;
    }
    const text = (row.text || "").trim();
    if (text) {
      if (row.text_cleaned == null) missingCleaned += 1;
      else if (!row.text_cleaned.trim()) emptyCleaned += 1;
    }
    if (engineOf(row) === "whisper") {
      whisperRows += 1;
      if (qualityComplete(row)) qualityOk += 1;
      else qualityMissing.push(row.id);
      if (provenanceComplete(row)) provenanceOk += 1;
      else provenanceMissing.push(row.id);
    }
  }

  const rawAll = await readRawTranscript(db, captureSessionId, {
    includeFlagged: true,
    includeVector: true,
  });
  const cleaned = await readCleanedTranscript(db, captureSessionId, {
    includeFlagged: false,
    includeVector: true,
  });
  const corpus = await fetchTrainerCorpusSegments(db, captureSessionId, "cleaned");

  const audio = await measureAudioCoverage(db, captureSessionId);

  const unflaggedRider = stored.filter(
    (r) => r.speaker === "rider" && !flagOf(r)
  ).length;
  const unflaggedTrainer = stored.filter(
    (r) => r.speaker === "trainer" && !flagOf(r)
  ).length;

  if (stored.length === 0) reasons.push("no transcript segments stored");
  if ((bySpeaker.rider || 0) === 0) reasons.push("no rider segments");
  if ((bySpeaker.trainer || 0) === 0) reasons.push("no trainer segments");
  if (stored.length > 0 && unflaggedRider === 0) {
    reasons.push("every rider segment is flagged — no usable rider speech");
  }
  if (stored.length > 0 && unflaggedTrainer === 0) {
    reasons.push("every trainer segment is flagged — no usable trainer speech");
  }
  if ((byEngine.whisper || 0) === 0) {
    reasons.push("no Whisper segments — quality and provenance cannot be checked");
  }
  if (whisperRows > 0 && qualityOk < whisperRows) {
    reasons.push(
      `${whisperRows - qualityOk} Whisper segment(s) missing numeric quality signals`
    );
  }
  if (whisperRows > 0 && provenanceOk < whisperRows) {
    reasons.push(
      `${whisperRows - provenanceOk} Whisper segment(s) missing model, prompt version, VAD field, or producing path`
    );
  }
  if (missingCleaned > 0) {
    reasons.push(`${missingCleaned} segment(s) have no text_cleaned`);
  }
  if (emptyCleaned > 0) {
    reasons.push(
      `${emptyCleaned} segment(s) have empty text_cleaned — cleanup removed a line`
    );
  }
  if (excludedWithoutReason > 0) {
    reasons.push(
      `${excludedWithoutReason} excluded rider/trainer row(s) have no flag reason`
    );
  }
  if (rawAll.error) reasons.push(`raw reader error: ${rawAll.error}`);
  if (cleaned.error) reasons.push(`cleaned reader error: ${cleaned.error}`);
  if (corpus.error) reasons.push(`corpus reader error: ${corpus.error}`);
  if (!rawAll.error && rawAll.data.length !== stored.length) {
    reasons.push(
      `raw reader returned ${rawAll.data.length} rows, stored ${stored.length}`
    );
  }
  const expectedCleaned = stored.length - flagged;
  if (!cleaned.error && cleaned.data.length !== expectedCleaned) {
    reasons.push(
      `cleaned reader returned ${cleaned.data.length} rows, expected ${expectedCleaned} (stored minus flagged)`
    );
  }

  if (audio.assets === 0) reasons.push("no audio_recording assets");
  if (audio.missingObjects.length > 0) {
    reasons.push(
      `${audio.missingObjects.length} asset path(s) do not resolve to an object`
    );
  }
  if (audio.unparsedPaths.length > 0) {
    reasons.push(`${audio.unparsedPaths.length} asset path(s) are unrecognised`);
  }
  if (audio.needsFfprobe) {
    reasons.push(FFPROBE_MISSING_REASON);
  }
  const durationUnknown = audio.bySpeaker.some(
    (s) => s.chunks > 0 && s.coveragePct == null
  );
  if (durationUnknown && !audio.needsFfprobe) {
    reasons.push(
      "audio duration could not be measured for one or more speakers"
    );
  }
  const speakersWithAudio = new Set(audio.bySpeaker.map((s) => s.speaker));
  if (!speakersWithAudio.has("rider")) reasons.push("no rider audio chunks");
  if (!speakersWithAudio.has("trainer")) reasons.push("no trainer audio chunks");
  for (const s of audio.bySpeaker) {
    if (s.unreadable > 0) {
      reasons.push(`${s.unreadable} ${s.speaker} chunk(s) unreadable`);
    }
    if (s.overlaps > 0) {
      reasons.push(
        `${s.speaker} audio has ${s.overlaps} overlapping chunk(s) — timestamps after the first drift`
      );
    }
    if (s.coveragePct != null && s.coveragePct < MIN_COVERAGE_PCT) {
      reasons.push(
        `${s.speaker} coverage ${s.coveragePct.toFixed(1)}% is under ${MIN_COVERAGE_PCT}%`
      );
    }
    if (s.largestGapMs > MAX_GAP_MS) {
      reasons.push(
        `${s.speaker} largest gap ${(s.largestGapMs / 1000).toFixed(1)}s exceeds ${MAX_GAP_MS / 1000}s`
      );
    }
  }

  if (capture?.is_test) {
    reasons.push("session is tagged is_test — not a measurement baseline");
  }

  return {
    generated_at: new Date().toISOString(),
    capture_session_id: captureSessionId,
    training_session_id: (capture?.training_session_id as string | null) ?? null,
    is_test: Boolean(capture?.is_test),
    segments: {
      total: stored.length,
      by_speaker: bySpeaker,
      by_engine: byEngine,
      superseded_pairs: supersededPairs,
      unique_after_pairs: stored.length - supersededPairs,
      flagged,
      by_flag_reason: byFlag,
    },
    reads: {
      stored: stored.length,
      raw_including_flagged: rawAll.data.length,
      cleaned_display: cleaned.data.length,
      corpus_cleaned: corpus.data.length,
      flagged,
    },
    audio,
    provenance: {
      whisper_rows: whisperRows,
      complete: provenanceOk,
      missing: provenanceMissing,
    },
    quality: {
      whisper_rows: whisperRows,
      complete: qualityOk,
      missing: qualityMissing,
    },
    wording: {
      empty_cleaned: emptyCleaned,
      missing_cleaned: missingCleaned,
    },
    flags: {
      excluded_without_reason: excludedWithoutReason,
    },
    verdict: {
      usable_as_baseline: reasons.length === 0,
      reasons,
    },
  };
}

export function formatVerifyMarkdown(report: SessionVerifyReport): string {
  const lines: string[] = [];
  const A = (s = "") => lines.push(s);
  A(`# Capture verify — ${report.capture_session_id}`);
  A("");
  A(`Generated ${report.generated_at}`);
  if (report.training_session_id) {
    A(`Training session \`${report.training_session_id}\``);
  }
  A(`is_test: ${report.is_test}`);
  A("");
  A("## Verdict");
  A("");
  if (report.verdict.usable_as_baseline) {
    A("**Yes. Usable as a measurement baseline.**");
  } else {
    A("**No. Not usable as a measurement baseline.**");
    A("");
    for (const reason of report.verdict.reasons) {
      A(`- ${reason}`);
    }
  }
  A("");
  A("## Segments");
  A("");
  A(`Total stored: ${report.segments.total}`);
  A(
    `Superseded pairs: ${report.segments.superseded_pairs} (browser guess + Whisper for the same window; both rows exist; counted once → ${report.segments.unique_after_pairs} unique utterances)`
  );
  A(`Flagged: ${report.segments.flagged}`);
  A("");
  A("By speaker:");
  A("");
  for (const [k, n] of Object.entries(report.segments.by_speaker).sort()) {
    A(`- ${k}: ${n}`);
  }
  A("");
  A("By engine:");
  A("");
  for (const [k, n] of Object.entries(report.segments.by_engine).sort()) {
    A(`- ${k}: ${n}`);
  }
  A("");
  A("By flag_reason:");
  A("");
  const flags = Object.entries(report.segments.by_flag_reason);
  if (flags.length === 0) A("- (none)");
  for (const [k, n] of flags.sort((a, b) => b[1] - a[1])) {
    A(`- ${k}: ${n}`);
  }
  A("");
  A("## Readers");
  A("");
  A(`- stored: ${report.reads.stored}`);
  A(`- raw including flagged: ${report.reads.raw_including_flagged}`);
  A(`- cleaned display: ${report.reads.cleaned_display}`);
  A(`- corpus cleaned: ${report.reads.corpus_cleaned}`);
  A("");
  A("## Audio");
  A("");
  A(`Assets: ${report.audio.assets}`);
  A(`ffmpeg: ${report.audio.ffmpeg}`);
  if (report.audio.needsFfprobe) {
    A("");
    A(`**${FFPROBE_MISSING_REASON}**`);
  }
  if (report.audio.missingObjects.length) {
    A(`Missing objects: ${report.audio.missingObjects.length}`);
    for (const p of report.audio.missingObjects.slice(0, 8)) A(`- \`${p}\``);
  }
  if (report.audio.unparsedPaths.length) {
    A(`Unrecognised paths: ${report.audio.unparsedPaths.length}`);
  }
  A("");
  for (const s of report.audio.bySpeaker) {
    const cov =
      s.coveragePct == null ? "n/a" : `${s.coveragePct.toFixed(1)}%`;
    A(`### ${s.speaker}`);
    A("");
    A(`- chunks: ${s.chunks}`);
    A(`- audio: ${(s.audioMs / 1000).toFixed(1)}s`);
    A(`- span: ${(s.spanMs / 1000).toFixed(1)}s`);
    A(`- total gap: ${(s.totalGapMs / 1000).toFixed(1)}s`);
    A(`- largest gap: ${(s.largestGapMs / 1000).toFixed(1)}s`);
    A(`- coverage: ${cov}`);
    A(`- overlaps: ${s.overlaps}`);
    A("");
  }
  A("## Provenance (Whisper)");
  A("");
  A(`${report.provenance.complete} / ${report.provenance.whisper_rows} complete`);
  A("");
  A("## Quality (Whisper)");
  A("");
  A(`${report.quality.complete} / ${report.quality.whisper_rows} complete`);
  A("");
  A("## Wording");
  A("");
  A(`- missing text_cleaned: ${report.wording.missing_cleaned}`);
  A(`- empty text_cleaned: ${report.wording.empty_cleaned}`);
  A(`- excluded without reason: ${report.flags.excluded_without_reason}`);
  A("");
  A("## Verdict");
  A("");
  if (report.verdict.usable_as_baseline) {
    A("**Yes. Usable as a measurement baseline.**");
  } else {
    A("**No. Not usable as a measurement baseline.**");
    A("");
    for (const reason of report.verdict.reasons) {
      A(`- ${reason}`);
    }
  }
  A("");
  return lines.join("\n");
}

export function writeVerifyReport(
  report: SessionVerifyReport,
  outDir = path.join(process.cwd(), "tmp", "session-verify")
): { md: string; json: string } {
  mkdirSync(outDir, { recursive: true });
  const stamp = report.generated_at.replace(/[:.]/g, "-");
  const base = path.join(outDir, `${report.capture_session_id}-${stamp}`);
  const md = `${base}.md`;
  const json = `${base}.json`;
  writeFileSync(md, formatVerifyMarkdown(report), "utf8");
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { md, json };
}
