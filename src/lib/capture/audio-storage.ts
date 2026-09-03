/**
 * A0 · lesson audio retention.
 *
 * Mic chunks used to be transcribed in memory and dropped, which meant no
 * transcript could ever be checked against what was actually said. They are now
 * kept.
 *
 * Two rules this module exists to enforce:
 *
 * 1. Storage never blocks a lesson. The original code skipped uploads because
 *    bucket creation stalled lab rides. The bucket is now infrastructure — see
 *    the migration — and nothing here creates it. An upload failure logs and
 *    the ride continues without audio, which is the right trade.
 * 2. Nothing records a path until the object is there. A field that claims
 *    audio was saved when it wasn't is worse than no field.
 *
 * Retention lives in VECTOR_CONFIG.SESSION_AUDIO_RETENTION_DAYS. Keep-forever
 * today, and nothing here enforces it.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared with lesson video. Created by migration, never at request time.
 * Audio lives under a separate prefix in the same bucket.
 */
export const CAPTURE_BUCKET = "session-videos";

export type ChunkSpeaker = "rider" | "trainer";

function extensionFor(mime: string): string {
  const type = mime.split(";")[0].trim().toLowerCase();
  if (type.includes("mp4") || type.includes("m4a")) return "mp4";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

/**
 * Speaker and chunk id are in the path because `session_media_assets` has no
 * column for either, and the assembly script needs both. Offset leads so a
 * plain lexical listing is close to chronological.
 */
export function audioChunkPath(opts: {
  captureSessionId: string;
  speaker: ChunkSpeaker;
  syncOffsetMs: number;
  chunkId: string;
  mime: string;
}): string {
  const offset = String(Math.max(0, opts.syncOffsetMs)).padStart(9, "0");
  return `capture-audio/${opts.captureSessionId}/${opts.speaker}/${offset}-${opts.chunkId}.${extensionFor(opts.mime)}`;
}

/** Reads back what `audioChunkPath` encoded. Returns null for anything else. */
export function parseAudioChunkPath(path: string): {
  speaker: ChunkSpeaker;
  syncOffsetMs: number;
  chunkId: string;
} | null {
  const m = /^capture-audio\/[^/]+\/(rider|trainer)\/(\d+)-([^/.]+)\.[a-z0-9]+$/.exec(
    path
  );
  if (!m) return null;
  return {
    speaker: m[1] as ChunkSpeaker,
    syncOffsetMs: Number.parseInt(m[2], 10),
    chunkId: m[3],
  };
}

/**
 * Store one mic chunk and record it. Never throws: the caller is a lesson.
 * Returns the path only when the object and its asset row both exist.
 */
export async function storeAudioChunk(opts: {
  captureSessionId: string;
  speaker: ChunkSpeaker;
  syncOffsetMs: number;
  chunkId: string;
  bytes: Uint8Array;
  mime: string;
}): Promise<{ storagePath: string | null }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { storagePath: null };

  const path = audioChunkPath(opts);

  try {
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from(CAPTURE_BUCKET)
      .upload(path, opts.bytes, { contentType: opts.mime, upsert: true });

    if (upErr) {
      console.error("lesson audio upload failed", path, upErr.message);
      return { storagePath: null };
    }

    // upsert:true means a retry overwrites the object; the row must not double.
    const { data: existing } = await admin
      .from("session_media_assets")
      .select("id")
      .eq("capture_session_id", opts.captureSessionId)
      .eq("storage_path", path)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await admin
        .from("session_media_assets")
        .insert({
          capture_session_id: opts.captureSessionId,
          kind: "audio_recording",
          storage_path: path,
          sync_offset_ms: Math.max(0, opts.syncOffsetMs),
        });
      if (insErr) {
        console.error("lesson audio asset row failed", path, insErr.message);
        return { storagePath: null };
      }
    }

    return { storagePath: path };
  } catch (e) {
    console.error("lesson audio store threw", path, e);
    return { storagePath: null };
  }
}
