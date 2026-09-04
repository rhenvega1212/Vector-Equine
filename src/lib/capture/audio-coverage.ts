/**
 * Gap and coverage numbers for lesson audio chunks.
 *
 * Same arithmetic as scripts/assemble-session-audio.ts: offsets are session
 * clock, so a hole between chunks is silence, not a splice. A naive concat
 * would hide that hole and shift every later timestamp.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CAPTURE_BUCKET,
  parseAudioChunkPath,
  type ChunkSpeaker,
} from "@/lib/capture/audio-storage";

export type AudioChunkReport = {
  speaker: ChunkSpeaker;
  chunks: number;
  audioMs: number;
  totalGapMs: number;
  largestGapMs: number;
  largestGapAtMs: number;
  overlaps: number;
  overlapMs: number;
  spanMs: number;
  coveragePct: number | null;
  unreadable: number;
};

export type AlignedChunk = {
  startMs: number;
  durationMs: number;
};

/**
 * Session-clock arithmetic shared with assemble-session-audio.
 * Cursor starts at 0: a late first chunk is a leading gap, not a late start.
 */
export function summarizeAlignedChunks(chunks: AlignedChunk[]): {
  audioMs: number;
  totalGapMs: number;
  largestGapMs: number;
  largestGapAtMs: number;
  overlaps: number;
  overlapMs: number;
  spanMs: number;
  coveragePct: number | null;
} {
  const sorted = [...chunks].sort((a, b) => a.startMs - b.startMs);
  let cursorMs = 0;
  let audioMs = 0;
  let totalGapMs = 0;
  let largestGapMs = 0;
  let largestGapAtMs = 0;
  let overlaps = 0;
  let overlapMs = 0;

  for (const chunk of sorted) {
    const gapMs = chunk.startMs - cursorMs;
    if (gapMs > 0) {
      totalGapMs += gapMs;
      if (gapMs > largestGapMs) {
        largestGapMs = gapMs;
        largestGapAtMs = cursorMs;
      }
      cursorMs += gapMs;
    } else if (gapMs < 0) {
      overlaps += 1;
      overlapMs += -gapMs;
    }
    cursorMs += chunk.durationMs;
    audioMs += chunk.durationMs;
  }

  return {
    audioMs,
    totalGapMs,
    largestGapMs,
    largestGapAtMs,
    overlaps,
    overlapMs,
    spanMs: cursorMs,
    coveragePct: cursorMs > 0 ? (audioMs / cursorMs) * 100 : null,
  };
}

export type AudioCoverageReport = {
  ffmpeg: boolean;
  /** Non-WAV chunks were present and ffprobe was not on PATH. */
  needsFfprobe: boolean;
  assets: number;
  missingObjects: string[];
  unparsedPaths: string[];
  bySpeaker: AudioChunkReport[];
};

export type DurationRead =
  | { ok: true; durationMs: number; via: "wav" | "ffprobe" }
  | { ok: false; reason: "need_ffprobe" | "unreadable" };

export function hasBinary(name: string): boolean {
  try {
    execFileSync(name, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function hasFfprobe(): boolean {
  return hasBinary("ffmpeg") && hasBinary("ffprobe");
}

function ffprobeDurationMs(file: string): number | null {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        file,
      ],
      { encoding: "utf8" }
    ).trim();
    const seconds = Number.parseFloat(out);
    if (!Number.isFinite(seconds)) return null;
    return Math.round(seconds * 1000);
  } catch {
    return null;
  }
}

function toWav(input: string, output: string): boolean {
  try {
    execFileSync(
      "ffmpeg",
      ["-v", "error", "-y", "-i", input, "-ac", "1", "-ar", "16000", output],
      { stdio: "ignore" }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Time one chunk. WAV is read from the header. Everything else — including
 * the webm MediaRecorder writes — goes through ffmpeg/ffprobe.
 */
export function readChunkDuration(
  bytes: Uint8Array,
  opts: { ffmpeg: boolean; rawFile: string; wavFile: string }
): DurationRead {
  const fromWav = wavDurationMs(bytes);
  if (fromWav != null) return { ok: true, durationMs: fromWav, via: "wav" };

  if (!opts.ffmpeg) return { ok: false, reason: "need_ffprobe" };

  writeFileSync(opts.rawFile, Buffer.from(bytes));
  if (!toWav(opts.rawFile, opts.wavFile)) {
    return { ok: false, reason: "unreadable" };
  }
  const durationMs = ffprobeDurationMs(opts.wavFile);
  if (durationMs == null) return { ok: false, reason: "unreadable" };
  return { ok: true, durationMs, via: "ffprobe" };
}

/** PCM WAV only. Real rides are webm and still need ffmpeg. */
export function wavDurationMs(buf: Uint8Array): number | null {
  if (buf.byteLength < 44) return null;
  const view = Buffer.from(buf);
  if (view.toString("ascii", 0, 4) !== "RIFF") return null;
  if (view.toString("ascii", 8, 12) !== "WAVE") return null;
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= view.length) {
    const id = view.toString("ascii", offset, offset + 4);
    const size = view.readUInt32LE(offset + 4);
    if (id === "fmt " && size >= 16) {
      byteRate = view.readUInt32LE(offset + 16);
    } else if (id === "data") {
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (byteRate <= 0 || dataSize <= 0) return null;
  return Math.round((dataSize / byteRate) * 1000);
}

export async function measureAudioCoverage(
  db: SupabaseClient,
  captureSessionId: string
): Promise<AudioCoverageReport> {
  const ffmpeg = hasFfprobe();
  const { data: assets, error } = await db
    .from("session_media_assets")
    .select("storage_path, sync_offset_ms")
    .eq("capture_session_id", captureSessionId)
    .eq("kind", "audio_recording")
    .order("sync_offset_ms", { ascending: true });

  if (error) {
    return {
      ffmpeg,
      needsFfprobe: false,
      assets: 0,
      missingObjects: [`query failed: ${error.message}`],
      unparsedPaths: [],
      bySpeaker: [],
    };
  }

  const missingObjects: string[] = [];
  const unparsedPaths: string[] = [];
  let needsFfprobe = false;
  const grouped = new Map<
    ChunkSpeaker,
    Array<{ storagePath: string; syncOffsetMs: number }>
  >();

  for (const a of assets || []) {
    const storagePath = (a.storage_path as string) || "";
    const parsed = parseAudioChunkPath(storagePath);
    if (!parsed) {
      unparsedPaths.push(storagePath);
      continue;
    }
    const list = grouped.get(parsed.speaker) || [];
    list.push({ storagePath, syncOffsetMs: parsed.syncOffsetMs });
    grouped.set(parsed.speaker, list);
  }

  const bySpeaker: AudioChunkReport[] = [];
  const work = path.join(tmpdir(), `ve-verify-audio-${captureSessionId}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  for (const [speaker, list] of grouped) {
    list.sort((a, b) => a.syncOffsetMs - b.syncOffsetMs);
    const timed: AlignedChunk[] = [];
    let unreadable = 0;
    let index = 0;

    for (const chunk of list) {
      const { data: blob, error: downErr } = await db.storage
        .from(CAPTURE_BUCKET)
        .download(chunk.storagePath);
      if (downErr || !blob) {
        missingObjects.push(chunk.storagePath);
        unreadable += 1;
        index += 1;
        continue;
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const ext = path.extname(chunk.storagePath) || ".webm";
      const read = readChunkDuration(bytes, {
        ffmpeg,
        rawFile: path.join(work, `${speaker}-${index}${ext}`),
        wavFile: path.join(work, `${speaker}-${index}.wav`),
      });
      if (!read.ok) {
        if (read.reason === "need_ffprobe") needsFfprobe = true;
        else unreadable += 1;
        index += 1;
        continue;
      }

      timed.push({ startMs: chunk.syncOffsetMs, durationMs: read.durationMs });
      index += 1;
    }

    const summary = summarizeAlignedChunks(timed);
    bySpeaker.push({
      speaker,
      chunks: list.length,
      ...summary,
      unreadable,
    });
  }

  rmSync(work, { recursive: true, force: true });

  return {
    ffmpeg,
    needsFfprobe,
    assets: (assets || []).length,
    missingObjects,
    unparsedPaths,
    bySpeaker,
  };
}
