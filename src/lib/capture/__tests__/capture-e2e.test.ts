/**
 * Real-path capture ingest. Skipped unless CAPTURE_E2E=1 and the live
 * keys are present. Not a mock: it writes a test session, posts mic
 * chunks through storeAudioChunk + applyWhisperBytes (the same functions
 * the audio route calls), and asserts against what landed.
 *
 *   npm run test:capture
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyWhisperBytes } from "@/lib/capture/apply-whisper-bytes";
import { storeAudioChunk, CAPTURE_BUCKET } from "@/lib/capture/audio-storage";
import { generateJoinCode } from "@/lib/capture/guest-token";
import { browserProvenance } from "@/lib/capture/asr-provenance";
import { emptyQualitySignals } from "@/lib/capture/asr-flags";
import { displayTranscriptText } from "@/lib/capture/asr-cleanup";
import {
  readCleanedTranscript,
  readRawTranscript,
} from "@/lib/capture/transcript-read";
import {
  verifyCaptureSession,
  writeVerifyReport,
} from "@/lib/capture/session-verify";
import { isWhisperConfigured } from "@/lib/capture/whisper";

const enabled = process.env.CAPTURE_E2E === "1";
const haveKeys = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    isWhisperConfigured()
);

const RIDER_LINE = "Inside leg to outside rein. Half halt before the corner.";
const TRAINER_LINE = "Don't make the circle smaller. Make the canter smaller.";

function speechWav(text: string): Uint8Array {
  try {
    execFileSync("say", ["-v", "?"], { stdio: "ignore" });
  } catch {
    throw new Error("macOS say is required for capture e2e speech");
  }
  const dir = mkdtempSync(path.join(tmpdir(), "ve-e2e-"));
  const wav = path.join(dir, "say.wav");
  try {
    execFileSync(
      "say",
      [
        "-o",
        wav,
        "--file-format=WAVE",
        "--data-format=LEI16@16000",
        text,
      ],
      { stdio: "ignore" }
    );
    return new Uint8Array(readFileSync(wav));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!enabled || !haveKeys)("capture e2e", () => {
  let captureId: string | null = null;
  const storagePaths: string[] = [];

  afterAll(async () => {
    if (!captureId) return;
    const admin = createAdminClient();
    const prefix = `capture-audio/${captureId}`;
    for (const speaker of ["rider", "trainer"] as const) {
      const { data } = await admin.storage
        .from(CAPTURE_BUCKET)
        .list(`${prefix}/${speaker}`);
      const names = (data || []).map((f) => `${prefix}/${speaker}/${f.name}`);
      if (names.length) {
        await admin.storage.from(CAPTURE_BUCKET).remove(names);
      }
    }
    if (storagePaths.length) {
      await admin.storage.from(CAPTURE_BUCKET).remove(storagePaths);
    }
    await admin.from("capture_sessions").delete().eq("id", captureId);
  });

  it(
    "writes verbatim transcript, cleaned wording, flags, quality, provenance, and audio for both speakers",
    async () => {
      const admin = createAdminClient();
      const riderId =
        process.env.CAPTURE_E2E_RIDER_ID ||
        (
          await admin
            .from("profiles")
            .select("id")
            .eq("role", "admin")
            .limit(1)
            .maybeSingle()
        ).data?.id;
      if (!riderId) {
        throw new Error("No admin profile. Set CAPTURE_E2E_RIDER_ID.");
      }

      const join = generateJoinCode(6);
      const { data: created, error: createErr } = await admin
        .from("capture_sessions")
        .insert({
          rider_id: riderId,
          join_code: join.toUpperCase(),
          livekit_room: `e2e_${join}_${Date.now()}`,
          status: "live",
          is_test: true,
          ride_mode: "with_trainer",
          trainer_display_name: "E2E",
        })
        .select("id")
        .single();
      if (createErr || !created) {
        throw new Error(createErr?.message || "failed to create capture session");
      }
      captureId = created.id as string;

      const riderWav = speechWav(RIDER_LINE);
      const trainerWav = speechWav(TRAINER_LINE);

      // Browser guess first, so Whisper can supersede it without deleting it.
      const browserText = "Inside leg to outside rein.";
      const { error: browserErr } = await admin
        .from("session_transcript_segments")
        .insert({
          capture_session_id: captureId,
          speaker: "rider",
          text: browserText,
          text_cleaned: displayTranscriptText(browserText),
          offset_ms: 400,
          client_id: `browser:rider:e2e:${captureId}`,
          excluded_from_corpus: false,
          raw_json: {
            ...browserProvenance(),
            quality: emptyQualitySignals(),
          },
        });
      if (browserErr) throw new Error(browserErr.message);

      const riderChunk = "e2erider1";
      const trainerChunk = "e2etrainer1";

      const riderStore = await storeAudioChunk({
        captureSessionId: captureId,
        speaker: "rider",
        syncOffsetMs: 0,
        chunkId: riderChunk,
        bytes: riderWav,
        mime: "audio/wav",
      });
      const trainerStore = await storeAudioChunk({
        captureSessionId: captureId,
        speaker: "trainer",
        syncOffsetMs: 0,
        chunkId: trainerChunk,
        bytes: trainerWav,
        mime: "audio/wav",
      });
      expect(riderStore.storagePath, "rider audio stored").toBeTruthy();
      expect(trainerStore.storagePath, "trainer audio stored").toBeTruthy();
      if (riderStore.storagePath) storagePaths.push(riderStore.storagePath);
      if (trainerStore.storagePath) storagePaths.push(trainerStore.storagePath);

      const riderWhisper = await applyWhisperBytes({
        captureSessionId: captureId,
        audio: riderWav,
        speaker: "rider",
        syncOffsetMs: 0,
        mediaType: "audio/wav",
        windowMs: 10_000,
        chunkId: riderChunk,
      });
      const trainerWhisper = await applyWhisperBytes({
        captureSessionId: captureId,
        audio: trainerWav,
        speaker: "trainer",
        syncOffsetMs: 0,
        mediaType: "audio/wav",
        windowMs: 10_000,
        chunkId: trainerChunk,
      });

      expect(riderWhisper.segments.length).toBeGreaterThan(0);
      expect(trainerWhisper.segments.length).toBeGreaterThan(0);

      const { data: stored, error: storedErr } = await admin
        .from("session_transcript_segments")
        .select(
          "id, speaker, text, text_cleaned, client_id, excluded_from_corpus, flag_reason, raw_json"
        )
        .eq("capture_session_id", captureId);
      if (storedErr) throw new Error(storedErr.message);
      const rows = stored || [];
      expect(rows.length).toBeGreaterThan(1);

      const returned = [
        ...riderWhisper.segments.map((s, i) => ({
          client_id: `whisper:rider:${riderChunk}:${i}`,
          text: s.text,
        })),
        ...trainerWhisper.segments.map((s, i) => ({
          client_id: `whisper:trainer:${trainerChunk}:${i}`,
          text: s.text,
        })),
      ];
      for (const ret of returned) {
        const row = rows.find((r) => r.client_id === ret.client_id);
        expect(row, `stored row for ${ret.client_id}`).toBeTruthy();
        expect(row!.text, "text byte-identical to Whisper return").toBe(ret.text);
      }

      for (const row of rows) {
        const text = String(row.text || "");
        if (!text.trim()) continue;
        const cleaned = String(row.text_cleaned || "");
        expect(cleaned.trim().length, "text_cleaned populated").toBeGreaterThan(
          0
        );
        expect(
          cleaned,
          "text_cleaned is a wording tidy, never a removal"
        ).toBe(displayTranscriptText(text));
      }

      for (const row of rows) {
        const reason =
          (row.flag_reason as string | null) ||
          ((row.raw_json as { exclusion_reason?: string } | null)
            ?.exclusion_reason ??
            null);
        if (row.excluded_from_corpus && row.speaker !== "vector") {
          expect(reason, `flag reason on ${row.id}`).toBeTruthy();
        }
      }

      const whisperRows = rows.filter(
        (r) => (r.raw_json as { engine?: string } | null)?.engine === "whisper"
      );
      expect(whisperRows.length).toBeGreaterThan(0);
      for (const row of whisperRows) {
        const j = (row.raw_json || {}) as Record<string, unknown>;
        const q = (j.quality || {}) as Record<string, unknown>;
        expect(typeof q.no_speech_prob).toBe("number");
        expect(typeof q.avg_logprob).toBe("number");
        expect(typeof q.compression_ratio).toBe("number");
        expect(j.model).toBeTruthy();
        expect(j.prompt_version).toBeTruthy();
        expect("vad" in j).toBe(true);
        expect(j.producing_path === "cloud" || j.producing_path === "edge").toBe(
          true
        );
      }

      const { data: assets } = await admin
        .from("session_media_assets")
        .select("storage_path")
        .eq("capture_session_id", captureId)
        .eq("kind", "audio_recording");
      expect((assets || []).length).toBe(2);
      for (const a of assets || []) {
        const p = a.storage_path as string;
        const { data, error } = await admin.storage
          .from(CAPTURE_BUCKET)
          .download(p);
        expect(error, p).toBeNull();
        expect(data, p).toBeTruthy();
      }

      const speakers = new Set(whisperRows.map((r) => r.speaker));
      expect(speakers.has("rider")).toBe(true);
      expect(speakers.has("trainer")).toBe(true);

      const flagged = rows.filter((r) => {
        const reason =
          (r.flag_reason as string | null) ||
          ((r.raw_json as { exclusion_reason?: string } | null)
            ?.exclusion_reason ??
            null);
        return Boolean(reason);
      }).length;

      const raw = await readRawTranscript(admin, captureId, {
        includeFlagged: true,
        includeVector: true,
      });
      const cleaned = await readCleanedTranscript(admin, captureId, {
        includeFlagged: false,
        includeVector: true,
      });
      expect(raw.error).toBeNull();
      expect(cleaned.error).toBeNull();
      expect(raw.data.length).toBe(rows.length);
      expect(cleaned.data.length).toBe(rows.length - flagged);

      const superseded = rows.filter(
        (r) =>
          ((r.raw_json as { exclusion_reason?: string } | null)
            ?.exclusion_reason === "superseded_by_whisper")
      );
      expect(superseded.length).toBeGreaterThan(0);
      expect(rows.some((r) => r.client_id === `browser:rider:e2e:${captureId}`)).toBe(
        true
      );

      const report = await verifyCaptureSession(admin, captureId);
      writeVerifyReport(report);
      expect(report.verdict.reasons).toEqual([
        "session is tagged is_test — not a measurement baseline",
      ]);
    },
    180_000
  );
});
