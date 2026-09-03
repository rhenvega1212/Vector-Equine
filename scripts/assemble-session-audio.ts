/**
 * A0.4 — assemble one continuous audio file per speaker from a session's chunks.
 *
 * Chunks are the durable artifact; this is derived and can be re-run any time.
 * It is a laptop script on purpose: nothing about it belongs in the recording
 * path, which is the thing this whole section exists to protect.
 *
 * Why it does not just concatenate:
 *
 * Chunks come from MediaRecorder stop/restart, so there are gaps between them.
 * Concatenating closes those gaps and shifts everything after the first one out
 * of alignment with the session clock. The audio still sounds fine, which is
 * what makes it dangerous — you find out after hand-correcting a reference
 * transcript that every timestamp past the first gap is wrong. So gaps are
 * padded with silence, and the totals are reported so a session with too much
 * missing audio can be rejected as a baseline before anyone spends hours on it.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/assemble-session-audio.ts --capture <capture_session_id>
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/assemble-session-audio.ts --session <training_session_id>
 *
 * Options:
 *   --out <dir>   Output directory (default ./tmp/session-audio)
 *
 * Requires ffmpeg and ffprobe on PATH.
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CAPTURE_BUCKET,
  parseAudioChunkPath,
  type ChunkSpeaker,
} from "../src/lib/capture/audio-storage";

const SAMPLE_RATE = 16000;

type Chunk = {
  storagePath: string;
  speaker: ChunkSpeaker;
  syncOffsetMs: number;
  chunkId: string;
};

type SpeakerReport = {
  speaker: ChunkSpeaker;
  outPath: string;
  chunks: number;
  audioMs: number;
  totalGapMs: number;
  largestGapMs: number;
  largestGapAtMs: number;
  overlaps: number;
  overlapMs: number;
  spanMs: number;
};

function parseArgs(argv: string[]) {
  let capture: string | null = null;
  let session: string | null = null;
  let out = path.join(process.cwd(), "tmp", "session-audio");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--capture" && argv[i + 1]) capture = argv[++i];
    else if (argv[i] === "--session" && argv[i + 1]) session = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
    else if (!argv[i].startsWith("--") && !capture) capture = argv[i];
  }
  return { capture, session, out };
}

function requireBinary(name: string) {
  try {
    execFileSync(name, ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error(`${name} not found on PATH. Install ffmpeg and retry.`);
  }
}

function ffprobeDurationMs(file: string): number {
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
  if (!Number.isFinite(seconds)) {
    throw new Error(`Could not read duration of ${file}`);
  }
  return Math.round(seconds * 1000);
}

/** Normalise to mono 16k PCM so parts concatenate without surprises. */
function toWav(input: string, output: string) {
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", input, "-ac", "1", "-ar", String(SAMPLE_RATE), output],
    { stdio: "ignore" }
  );
}

function silenceWav(ms: number, output: string) {
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
      "-t",
      (ms / 1000).toFixed(3),
      output,
    ],
    { stdio: "ignore" }
  );
}

function concatWav(parts: string[], listFile: string, output: string) {
  writeFileSync(
    listFile,
    parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8"
  );
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c:a",
      "pcm_s16le",
      output,
    ],
    { stdio: "ignore" }
  );
}

function formatMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.capture && !args.session) {
    throw new Error("Pass --capture <capture_session_id> or --session <training_session_id>");
  }

  requireBinary("ffmpeg");
  requireBinary("ffprobe");

  const db = createClient(url, key, { auth: { persistSession: false } });

  let captureId = args.capture;
  if (!captureId && args.session) {
    const { data, error } = await db
      .from("capture_sessions")
      .select("id")
      .eq("training_session_id", args.session)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No capture session for training session ${args.session}`);
    captureId = data.id as string;
  }

  const { data: assets, error: assetsErr } = await db
    .from("session_media_assets")
    .select("storage_path, sync_offset_ms")
    .eq("capture_session_id", captureId!)
    .eq("kind", "audio_recording")
    .order("sync_offset_ms", { ascending: true });

  if (assetsErr) throw new Error(assetsErr.message);
  if (!assets?.length) {
    throw new Error(
      `No audio_recording assets for capture ${captureId}. Either the session predates audio retention or every upload failed.`
    );
  }

  const chunks: Chunk[] = [];
  const unparsed: string[] = [];
  for (const a of assets) {
    const storagePath = (a.storage_path as string) || "";
    const parsed = parseAudioChunkPath(storagePath);
    if (!parsed) {
      unparsed.push(storagePath);
      continue;
    }
    chunks.push({
      storagePath,
      speaker: parsed.speaker,
      // The path is authoritative for alignment; the column is a copy of it.
      syncOffsetMs: parsed.syncOffsetMs,
      chunkId: parsed.chunkId,
    });
  }

  if (unparsed.length) {
    console.warn(`Skipped ${unparsed.length} asset(s) with unrecognised paths:`);
    for (const p of unparsed.slice(0, 5)) console.warn(`  ${p}`);
  }

  const work = path.join(tmpdir(), `ve-audio-${captureId}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  mkdirSync(args.out, { recursive: true });

  const bySpeaker = new Map<ChunkSpeaker, Chunk[]>();
  for (const c of chunks) {
    const list = bySpeaker.get(c.speaker) || [];
    list.push(c);
    bySpeaker.set(c.speaker, list);
  }

  const reports: SpeakerReport[] = [];

  for (const [speaker, list] of Array.from(bySpeaker.entries())) {
    list.sort((a, b) => a.syncOffsetMs - b.syncOffsetMs);

    const parts: string[] = [];
    let cursorMs = 0;
    let audioMs = 0;
    let totalGapMs = 0;
    let largestGapMs = 0;
    let largestGapAtMs = 0;
    let overlaps = 0;
    let overlapMs = 0;
    let index = 0;

    for (const chunk of list) {
      const { data: blob, error } = await db.storage
        .from(CAPTURE_BUCKET)
        .download(chunk.storagePath);
      if (error || !blob) {
        console.warn(`  download failed, treated as a gap: ${chunk.storagePath}`);
        continue;
      }

      const ext = path.extname(chunk.storagePath) || ".webm";
      const rawFile = path.join(work, `${speaker}-${index}${ext}`);
      writeFileSync(rawFile, Buffer.from(await blob.arrayBuffer()));

      const wavFile = path.join(work, `${speaker}-${index}.wav`);
      try {
        toWav(rawFile, wavFile);
      } catch {
        console.warn(`  unreadable chunk, treated as a gap: ${chunk.storagePath}`);
        index++;
        continue;
      }

      const durationMs = ffprobeDurationMs(wavFile);
      const gapMs = chunk.syncOffsetMs - cursorMs;

      if (gapMs > 0) {
        // Absolute offsets have to survive, so the gap is real silence.
        const gapFile = path.join(work, `${speaker}-${index}-gap.wav`);
        silenceWav(gapMs, gapFile);
        parts.push(gapFile);
        totalGapMs += gapMs;
        if (gapMs > largestGapMs) {
          largestGapMs = gapMs;
          largestGapAtMs = cursorMs;
        }
        cursorMs += gapMs;
      } else if (gapMs < 0) {
        // Chunks overlap. Nothing is trimmed — that would need a resample
        // decision this script has no basis for. Reported instead, because it
        // means everything after here drifts late by this much.
        overlaps += 1;
        overlapMs += -gapMs;
      }

      parts.push(wavFile);
      cursorMs += durationMs;
      audioMs += durationMs;
      index++;
    }

    if (parts.length === 0) {
      console.warn(`No usable audio for ${speaker}.`);
      continue;
    }

    const outPath = path.join(args.out, `${captureId}-${speaker}.wav`);
    concatWav(parts, path.join(work, `${speaker}-list.txt`), outPath);

    reports.push({
      speaker,
      outPath,
      chunks: list.length,
      audioMs,
      totalGapMs,
      largestGapMs,
      largestGapAtMs,
      overlaps,
      overlapMs,
      spanMs: cursorMs,
    });
  }

  rmSync(work, { recursive: true, force: true });

  console.log(`\nCapture ${captureId}`);
  for (const r of reports) {
    const coverage = r.spanMs > 0 ? (r.audioMs / r.spanMs) * 100 : 0;
    console.log(`\n${r.speaker}`);
    console.log(`  file             ${r.outPath}`);
    console.log(`  chunks           ${r.chunks}`);
    console.log(`  length           ${formatMs(r.spanMs)}`);
    console.log(`  audio            ${formatMs(r.audioMs)} (${coverage.toFixed(1)}% of span)`);
    console.log(`  silence in gaps  ${formatMs(r.totalGapMs)} across the session`);
    console.log(
      `  largest gap      ${(r.largestGapMs / 1000).toFixed(1)}s at ${formatMs(r.largestGapAtMs)}`
    );
    if (r.overlaps > 0) {
      console.log(
        `  OVERLAPS         ${r.overlaps} chunk(s), ${(r.overlapMs / 1000).toFixed(1)}s total — timings after the first drift late`
      );
    }
    if (coverage < 90) {
      console.log(
        `  WARNING          under 90% coverage. Weak candidate for a reference transcript.`
      );
    }
    if (r.largestGapMs > 5000) {
      console.log(
        `  WARNING          a gap over 5s means speech is missing, not just silence.`
      );
    }
  }
  console.log("");

  if (reports.length < 2) {
    console.log(
      `Only ${reports.length} speaker file produced. A baseline session needs both voices.`
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
