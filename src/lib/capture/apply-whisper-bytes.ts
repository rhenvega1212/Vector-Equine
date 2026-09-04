import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWhisperConfigured,
  transcribeLessonAudio,
  type WhisperSeg,
} from "@/lib/capture/whisper";
import { whisperProvenance } from "@/lib/capture/asr-provenance";
import { displayTranscriptText } from "@/lib/capture/asr-cleanup";

/**
 * Whisper a mic chunk straight from the bytes in the request and write the
 * timeline rows. Deliberately independent of storage: the chunk is uploaded in
 * parallel, and a storage outage must cost the audio without costing the
 * transcript.
 *
 * Writes verbatim `text` and a cleaned `text_cleaned`. Segments Whisper doubts
 * are flagged with a reason, never dropped.
 */
export async function applyWhisperBytes(opts: {
  captureSessionId: string;
  audio: Uint8Array | ArrayBuffer | Buffer;
  speaker: "rider" | "trainer";
  syncOffsetMs: number;
  mediaType?: string;
  windowMs?: number;
  chunkId?: string | null;
}): Promise<{ inserted: number; segments: WhisperSeg[] }> {
  if (!isWhisperConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { inserted: 0, segments: [] };
  }

  const buf =
    opts.audio instanceof Uint8Array
      ? opts.audio
      : new Uint8Array(opts.audio as ArrayBuffer);
  if (buf.byteLength < 64) return { inserted: 0, segments: [] };

  let segs: WhisperSeg[];
  try {
    segs = await transcribeLessonAudio({
      audio: buf,
      syncOffsetMs: opts.syncOffsetMs,
      mediaType: opts.mediaType || "audio/webm",
    });
  } catch (e) {
    console.error("whisper bytes transcribe", e);
    return { inserted: 0, segments: [] };
  }

  if (!segs.length) return { inserted: 0, segments: [] };

  const admin = createAdminClient();
  const windowMs = opts.windowMs ?? 18_000;
  const winStart = Math.max(0, opts.syncOffsetMs - 1500);
  const winEnd = opts.syncOffsetMs + windowMs + 2500;

  const { data: existing } = await admin
    .from("session_transcript_segments")
    .select("id, offset_ms, raw_json")
    .eq("capture_session_id", opts.captureSessionId)
    .eq("speaker", opts.speaker)
    .gte("offset_ms", winStart)
    .lte("offset_ms", winEnd);

  // client_id must not be derived from text: raw text can repeat across
  // overlapping chunks, and a collision on the unique index used to fail the
  // whole batch. Chunk identity plus position within the chunk is stable
  // across retries and unique across chunks.
  const chunkKey = opts.chunkId?.trim() || String(opts.syncOffsetMs);

  const rows = segs
    .map((s, i) => {
      const cleaned = displayTranscriptText(s.text);
      return {
        capture_session_id: opts.captureSessionId,
        offset_ms: s.offset_ms,
        ended_offset_ms: s.ended_offset_ms,
        speaker: opts.speaker,
        text: s.text,
        text_cleaned: cleaned,
        client_id: `whisper:${opts.speaker}:${chunkKey}:${i}`,
        excluded_from_corpus: s.excluded_from_corpus,
        raw_json: {
          ...whisperProvenance(),
          confidence: s.confidence,
          // Not a storage path. The upload runs in parallel with this write and
          // may fail, and a path recorded here would claim audio exists when it
          // might not. The asset row is the only claim that audio was stored;
          // its storage_path embeds this same chunk id.
          audio_chunk_id: chunkKey,
          quality: s.quality,
          exclusion_reason: s.exclusion_reason,
        },
      };
    })
    .filter((r) => r.text.trim().length > 0);

  if (!rows.length) return { inserted: 0, segments: [] };

  // Upsert rather than insert: one duplicate must not discard the whole chunk.
  const { error: insErr } = await admin
    .from("session_transcript_segments")
    .upsert(rows, {
      onConflict: "capture_session_id,client_id",
      ignoreDuplicates: true,
    });

  if (insErr) {
    console.error("whisper bytes insert", insErr);
    return { inserted: 0, segments: segs };
  }

  // Only now that the Whisper rows exist: the live browser guess for the same
  // speech stops being displayed. Flagged, never deleted — two independent
  // transcriptions of the same audio is the comparison this section exists to
  // make possible. Done after the insert so a failed write cannot leave the
  // timeline with neither version.
  const superseded = (existing || []).filter((row) => {
    const prior = (row.raw_json as { engine?: string } | null) || {};
    return prior.engine !== "whisper";
  });

  for (const row of superseded) {
    const prior = (row.raw_json as Record<string, unknown> | null) || {};
    const { error } = await admin
      .from("session_transcript_segments")
      .update({
        excluded_from_corpus: true,
        raw_json: { ...prior, exclusion_reason: "superseded_by_whisper" },
      })
      .eq("id", row.id);
    if (error) console.error("supersede browser row", row.id, error.message);
  }

  // Verbatim on the way out too. Callers that display these clean them.
  return { inserted: rows.length, segments: segs };
}
