import { describe, expect, it } from "vitest";
import {
  FFPROBE_MISSING_REASON,
  formatVerifyMarkdown,
  type SessionVerifyReport,
} from "@/lib/capture/session-verify";

function report(over: Partial<SessionVerifyReport> = {}): SessionVerifyReport {
  return {
    generated_at: "2026-09-03T12:00:00.000Z",
    capture_session_id: "cap-1",
    training_session_id: "train-1",
    is_test: false,
    segments: {
      total: 4,
      by_speaker: { rider: 2, trainer: 2 },
      by_engine: { whisper: 3, browser: 1 },
      superseded_pairs: 1,
      unique_after_pairs: 3,
      flagged: 1,
      by_flag_reason: { superseded_by_whisper: 1 },
    },
    reads: {
      stored: 4,
      raw_including_flagged: 4,
      cleaned_display: 3,
      corpus_cleaned: 3,
      flagged: 1,
    },
    audio: {
      ffmpeg: true,
      needsFfprobe: false,
      assets: 2,
      missingObjects: [],
      unparsedPaths: [],
      bySpeaker: [
        {
          speaker: "rider",
          chunks: 1,
          audioMs: 8000,
          totalGapMs: 0,
          largestGapMs: 0,
          largestGapAtMs: 0,
          overlaps: 0,
          overlapMs: 0,
          spanMs: 8000,
          coveragePct: 100,
          unreadable: 0,
        },
      ],
    },
    provenance: { whisper_rows: 3, complete: 3, missing: [] },
    quality: { whisper_rows: 3, complete: 3, missing: [] },
    wording: { empty_cleaned: 0, missing_cleaned: 0 },
    flags: { excluded_without_reason: 0 },
    verdict: { usable_as_baseline: true, reasons: [] },
    ...over,
  };
}

describe("formatVerifyMarkdown", () => {
  it("ends with a yes verdict when the session is usable", () => {
    const md = formatVerifyMarkdown(report());
    expect(md).toContain("Superseded pairs: 1");
    expect(md).toContain("unique utterances");
    expect(md).toMatch(
      /\*\*Yes\. Usable as a measurement baseline\.\*\*\s*$/
    );
  });

  it("names every reason when the verdict is no", () => {
    const md = formatVerifyMarkdown(
      report({
        verdict: {
          usable_as_baseline: false,
          reasons: [
            "no trainer audio chunks",
            "session is tagged is_test — not a measurement baseline",
          ],
        },
      })
    );
    expect(md).toContain("**No. Not usable as a measurement baseline.**");
    expect(md).toContain("- no trainer audio chunks");
    expect(md).toContain("is_test — not a measurement baseline");
    const lastVerdict = md.lastIndexOf("## Verdict");
    expect(lastVerdict).toBeGreaterThan(md.indexOf("## Segments"));
  });

  it("names a missing ffprobe as tooling, not a bad session", () => {
    const md = formatVerifyMarkdown(
      report({
        audio: {
          ffmpeg: false,
          needsFfprobe: true,
          assets: 2,
          missingObjects: [],
          unparsedPaths: [],
          bySpeaker: [],
        },
        verdict: {
          usable_as_baseline: false,
          reasons: [FFPROBE_MISSING_REASON],
        },
      })
    );
    expect(md).toContain("tooling problem, not a bad session");
    expect(md).toContain("which ffprobe");
  });
});
