import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWhisperConfigured,
  transcribeLessonAudio,
  type WhisperSeg,
} from "@/lib/capture/whisper";
import { cleanAsrText } from "@/lib/capture/asr-cleanup";

/**
 * Whisper raw mic bytes and insert timeline rows — no storage download required.
 * Used when the session-videos bucket is missing / upload fails.
 */
export async function applyWhisperBytes(opts: {
  captureSessionId: string;
  audio: Uint8Array | ArrayBuffer | Buffer;
  speaker: "rider" | "trainer";
  syncOffsetMs: number;
  mediaType?: string;
  windowMs?: number;
  chunkPath?: string | null;
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

  const toDelete = (existing || []).filter((row) => {
    const eng = (row.raw_json as { engine?: string } | null)?.engine;
    return eng !== "whisper";
  });

  if (toDelete.length) {
    await admin
      .from("session_transcript_segments")
      .delete()
      .in(
        "id",
        toDelete.map((r) => r.id)
      );
  }

  const rows = segs
    .map((s) => ({
      capture_session_id: opts.captureSessionId,
      offset_ms: s.offset_ms,
      ended_offset_ms: s.ended_offset_ms,
      speaker: opts.speaker,
      text: cleanAsrText(s.text),
      client_id: `whisper:${opts.speaker}:${s.offset_ms}:${s.text.slice(0, 20)}`,
      excluded_from_corpus: false,
      raw_json: {
        engine: "whisper",
        model: "whisper-1",
        confidence: s.confidence,
        chunk_path: opts.chunkPath ?? null,
      },
    }))
    .filter((r) => r.text.length > 0);

  if (!rows.length) return { inserted: 0, segments: [] };

  const { error: insErr } = await admin
    .from("session_transcript_segments")
    .insert(rows);

  if (insErr) {
    console.error("whisper bytes insert", insErr);
    return { inserted: 0, segments: segs };
  }

  return {
    inserted: rows.length,
    segments: segs.map((s) => ({ ...s, text: cleanAsrText(s.text) })),
  };
}
