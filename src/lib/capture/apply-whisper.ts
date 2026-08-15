import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWhisperConfigured,
  transcribeLessonAudio,
  type WhisperSeg,
} from "@/lib/capture/whisper";

const BUCKET = "session-videos";

function speakerFromPath(path: string): "rider" | "trainer" | null {
  if (path.includes("/rider/")) return "rider";
  if (path.includes("/trainer/")) return "trainer";
  return null;
}

/**
 * If lesson mic chunks were uploaded, re-transcribe with Whisper and replace
 * browser-ASR lines for those speakers. Returns the segment list to polish.
 */
export async function applyWhisperTranscript(opts: {
  captureSessionId: string;
  existing: Array<{
    id: string;
    speaker: string;
    text: string;
    offset_ms: number;
    raw_json: Record<string, unknown> | null;
  }>;
}): Promise<{
  segments: Array<{
    id: string;
    speaker: string;
    text: string;
    offset_ms: number;
    raw_json: Record<string, unknown> | null;
  }>;
  usedWhisper: boolean;
  speakers: Array<"rider" | "trainer">;
}> {
  if (!isWhisperConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      segments: opts.existing,
      usedWhisper: false,
      speakers: [],
    };
  }

  const admin = createAdminClient();
  const { data: assets } = await admin
    .from("session_media_assets")
    .select("id, storage_path, sync_offset_ms")
    .eq("capture_session_id", opts.captureSessionId)
    .eq("kind", "audio_recording")
    .order("sync_offset_ms", { ascending: true });

  if (!assets?.length) {
    return {
      segments: opts.existing,
      usedWhisper: false,
      speakers: [],
    };
  }

  const bySpeaker = new Map<"rider" | "trainer", WhisperSeg[]>();

  for (const asset of assets) {
    const path = asset.storage_path as string | null;
    if (!path) continue;
    const speaker = speakerFromPath(path);
    if (!speaker) continue;

    const { data: file, error } = await admin.storage.from(BUCKET).download(path);
    if (error || !file) {
      console.error("whisper download failed", path, error);
      continue;
    }

    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      if (buf.byteLength < 64) continue;
      const segs = await transcribeLessonAudio({
        audio: buf,
        syncOffsetMs: (asset.sync_offset_ms as number) || 0,
      });
      const list = bySpeaker.get(speaker) || [];
      list.push(...segs);
      bySpeaker.set(speaker, list);
    } catch (e) {
      console.error("whisper transcribe failed", path, e);
    }
  }

  if (bySpeaker.size === 0) {
    return {
      segments: opts.existing,
      usedWhisper: false,
      speakers: [],
    };
  }

  const replacedSpeakers = Array.from(bySpeaker.keys());

  // Drop prior browser (or older whisper) lines for speakers we re-transcribed
  await admin
    .from("session_transcript_segments")
    .delete()
    .eq("capture_session_id", opts.captureSessionId)
    .in("speaker", replacedSpeakers);

  const toInsert: Array<{
    capture_session_id: string;
    offset_ms: number;
    ended_offset_ms: number;
    speaker: string;
    text: string;
    confidence: number | null;
    raw_json: Record<string, unknown>;
    client_id: string;
  }> = [];

  for (const [speaker, segs] of Array.from(bySpeaker.entries())) {
    segs.sort((a, b) => a.offset_ms - b.offset_ms);
    for (const s of segs) {
      toInsert.push({
        capture_session_id: opts.captureSessionId,
        offset_ms: s.offset_ms,
        ended_offset_ms: s.ended_offset_ms,
        speaker,
        text: s.text,
        confidence: s.confidence,
        raw_json: {
          engine: "whisper",
          model: "whisper-1",
          asr_text: s.text,
        },
        client_id: `whisper:${speaker}:${s.offset_ms}:${s.text.slice(0, 24)}`,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await admin
      .from("session_transcript_segments")
      .insert(toInsert);
    if (insErr) {
      console.error("whisper segment insert", insErr);
      // Fall back to whatever still exists
      const { data: leftover } = await admin
        .from("session_transcript_segments")
        .select("id, speaker, text, offset_ms, raw_json")
        .eq("capture_session_id", opts.captureSessionId)
        .order("offset_ms", { ascending: true });
      return {
        segments: (leftover || []).map((s) => ({
          id: s.id as string,
          speaker: s.speaker as string,
          text: s.text as string,
          offset_ms: s.offset_ms as number,
          raw_json: (s.raw_json as Record<string, unknown> | null) || null,
        })),
        usedWhisper: false,
        speakers: [],
      };
    }
  }

  const { data: refreshed } = await admin
    .from("session_transcript_segments")
    .select("id, speaker, text, offset_ms, raw_json")
    .eq("capture_session_id", opts.captureSessionId)
    .order("offset_ms", { ascending: true });

  return {
    segments: (refreshed || []).map((s) => ({
      id: s.id as string,
      speaker: s.speaker as string,
      text: s.text as string,
      offset_ms: s.offset_ms as number,
      raw_json: (s.raw_json as Record<string, unknown> | null) || null,
    })),
    usedWhisper: true,
    speakers: replacedSpeakers,
  };
}
