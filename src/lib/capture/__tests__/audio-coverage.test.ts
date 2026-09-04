import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasFfprobe,
  readChunkDuration,
  summarizeAlignedChunks,
  wavDurationMs,
} from "@/lib/capture/audio-coverage";

describe("summarizeAlignedChunks", () => {
  it("treats a late first chunk as a leading gap, matching assemble", () => {
    const s = summarizeAlignedChunks([{ startMs: 2000, durationMs: 8000 }]);
    expect(s.totalGapMs).toBe(2000);
    expect(s.largestGapMs).toBe(2000);
    expect(s.largestGapAtMs).toBe(0);
    expect(s.audioMs).toBe(8000);
    expect(s.spanMs).toBe(10000);
    expect(s.coveragePct).toBe(80);
    expect(s.overlaps).toBe(0);
  });

  it("counts a hole between chunks and keeps the session clock", () => {
    const s = summarizeAlignedChunks([
      { startMs: 0, durationMs: 4000 },
      { startMs: 9000, durationMs: 4000 },
    ]);
    expect(s.totalGapMs).toBe(5000);
    expect(s.largestGapMs).toBe(5000);
    expect(s.largestGapAtMs).toBe(4000);
    expect(s.audioMs).toBe(8000);
    expect(s.spanMs).toBe(13000);
    expect(s.coveragePct).toBeCloseTo((8000 / 13000) * 100);
  });

  it("reports overlap instead of trimming", () => {
    const s = summarizeAlignedChunks([
      { startMs: 0, durationMs: 4000 },
      { startMs: 3000, durationMs: 4000 },
    ]);
    expect(s.overlaps).toBe(1);
    expect(s.overlapMs).toBe(1000);
    expect(s.totalGapMs).toBe(0);
    expect(s.audioMs).toBe(8000);
  });

  it("is 100% when chunks abut from t0", () => {
    const s = summarizeAlignedChunks([
      { startMs: 0, durationMs: 4000 },
      { startMs: 4000, durationMs: 4000 },
    ]);
    expect(s.totalGapMs).toBe(0);
    expect(s.overlaps).toBe(0);
    expect(s.coveragePct).toBe(100);
    expect(s.spanMs).toBe(8000);
  });
});

describe("wavDurationMs", () => {
  it("reads a mono 16k PCM header", () => {
    const byteRate = 16000 * 2;
    const dataSize = byteRate * 2;
    const buf = Buffer.alloc(44 + dataSize);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(16000, 24);
    buf.writeUInt32LE(byteRate, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataSize, 40);
    expect(wavDurationMs(buf)).toBe(2000);
  });

  it("rejects non-wav bytes", () => {
    expect(wavDurationMs(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("readChunkDuration webm", () => {
  it("says need_ffprobe for webm when the binary is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ve-webm-"));
    try {
      const read = readChunkDuration(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), {
        ffmpeg: false,
        rawFile: path.join(dir, "x.webm"),
        wavFile: path.join(dir, "x.wav"),
      });
      expect(read).toEqual({ ok: false, reason: "need_ffprobe" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!hasFfprobe())(
    "reads a real opus webm through ffprobe, not the WAV header",
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), "ve-webm-"));
      const webm = path.join(dir, "tone.webm");
      try {
        execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=1.2",
            "-c:a",
            "libopus",
            "-f",
            "webm",
            webm,
          ],
          { stdio: "ignore" }
        );
        const bytes = new Uint8Array(readFileSync(webm));
        expect(wavDurationMs(bytes), "webm is not a wav header").toBeNull();
        const read = readChunkDuration(bytes, {
          ffmpeg: true,
          rawFile: path.join(dir, "chunk.webm"),
          wavFile: path.join(dir, "chunk.wav"),
        });
        expect(read.ok).toBe(true);
        if (!read.ok) return;
        expect(read.via).toBe("ffprobe");
        expect(read.durationMs).toBeGreaterThan(1000);
        expect(read.durationMs).toBeLessThan(1600);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );
});
