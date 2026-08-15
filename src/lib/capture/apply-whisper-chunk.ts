import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWhisperConfigured,
  transcribeLessonAudio,
} from "@/lib/capture/whisper";
import { cleanAsrText } from "@/lib/capture/asr-cleanup";

const BUCKET = "session-videos";

/**
 * Whisper one uploaded mic chunk and merge into the live transcript.
 * Replaces overlapping browser-ASR lines for that speaker in the chunk window.
 */
export async function applyWhisperChunk(opts: {
  captureSessionId: string;
  storagePath: string;
  speaker: "rider" | "trainer";
  syncOffsetMs: number;
  /** Approximate chunk length for overlap window (ms). */
  windowMs?: number;
}): Promise<{ replaced: number; inserted: number }> {
  if (!isWhisperConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { replaced: 0, inserted: 0 };
  }

  const admin = createAdminClient();
  const { data: file, error } = await admin.storage
    .from(BUCKET)
    .download(opts.storagePath);
  if (error || !file) {
    console.error("whisper chunk download", opts.storagePath, error);
    return { replaced: 0, inserted: 0 };
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength < 64) return { replaced: 0, inserted: 0 };

  let segs;
  try {
    segs = await transcribeLessonAudio({
      audio: buf,
      syncOffsetMs: opts.syncOffsetMs,
      mediaType: file.type || "audio/webm",
    });
  } catch (e) {
    console.error("whisper chunk transcribe", e);
    return { replaced: 0, inserted: 0 };
  }

  if (!segs.length) return { replaced: 0, inserted: 0 };

  const windowMs = opts.windowMs ?? 50_000;
  const winStart = Math.max(0, opts.syncOffsetMs - 1500);
  const winEnd = opts.syncOffsetMs + windowMs + 2500;

  // Drop browser lines in this window for this speaker (keep prior whisper)
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

  const rows = segs.map((s) => ({
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
      chunk_path: opts.storagePath,
    },
  }));

  const { error: insErr } = await admin
    .from("session_transcript_segments")
    .insert(rows);

  if (insErr) {
    console.error("whisper chunk insert", insErr);
    return { replaced: toDelete.length, inserted: 0 };
  }

  return { replaced: toDelete.length, inserted: rows.length };
}
