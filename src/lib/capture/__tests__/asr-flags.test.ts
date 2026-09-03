import { describe, expect, it } from "vitest";
import { classifyHallucination, cleanAsrText } from "@/lib/capture/asr-cleanup";
import {
  AVG_LOGPROB_MIN,
  COMPRESSION_RATIO_MAX,
  NO_SPEECH_PROB_MAX,
  emptyQualitySignals,
  flagSegment,
  readQualitySignals,
} from "@/lib/capture/asr-flags";

const quality = (over: Partial<ReturnType<typeof emptyQualitySignals>> = {}) => ({
  ...emptyQualitySignals(),
  ...over,
});

describe("flagSegment", () => {
  it("keeps ordinary coaching speech", () => {
    const flag = flagSegment("Don't make the circle smaller. Make the canter smaller.");
    expect(flag).toEqual({ excluded: false, reason: null });
  });

  it("keeps a short timing marker that is not on the crumb list", () => {
    for (const text of ["Now.", "There.", "Softer.", "Not yet.", "Again."]) {
      expect(flagSegment(text).excluded, text).toBe(false);
    }
  });

  it("flags the timing markers that are on the crumb list, and keeps the text", () => {
    // These are the false positives the twelve-character rule produces. They
    // are flagged rather than deleted precisely so this is auditable — see
    // transcript_flag_audit. Do not "fix" this by changing the rule here.
    const flag = flagSegment("No.");
    expect(flag.excluded).toBe(true);
    expect(flag.reason).toBe("hallucination:short_crumb");
  });

  it("flags Whisper boilerplate with a named reason", () => {
    expect(flagSegment("Thanks for watching.").reason).toBe(
      "hallucination:boilerplate"
    );
    // Same phrase without the full-stop falls through to the substring rule.
    expect(flagSegment("Thanks for watching!").reason).toBe(
      "hallucination:prompt_echo"
    );
    expect(flagSegment("Transcribe only clear speech.").reason).toBe(
      "hallucination:boilerplate"
    );
    expect(
      flagSegment("Walk, trot, canter, halt, half-halt, inside leg.").reason
    ).toBe("hallucination:vocab_dump");
  });

  it("flags on quality signals before it looks at the text", () => {
    const good = "Inside leg to outside rein.";
    expect(
      flagSegment(good, quality({ no_speech_prob: NO_SPEECH_PROB_MAX + 0.01 }))
        .reason
    ).toBe("no_speech_prob");
    expect(
      flagSegment(good, quality({ avg_logprob: AVG_LOGPROB_MIN - 0.01 })).reason
    ).toBe("avg_logprob");
    expect(
      flagSegment(
        good,
        quality({ compression_ratio: COMPRESSION_RATIO_MAX + 0.01 })
      ).reason
    ).toBe("compression_ratio");
  });

  it("does not flag on signals inside the thresholds", () => {
    const flag = flagSegment(
      "Half-halt before the corner.",
      quality({
        no_speech_prob: NO_SPEECH_PROB_MAX,
        avg_logprob: AVG_LOGPROB_MIN,
        compression_ratio: COMPRESSION_RATIO_MAX,
      })
    );
    expect(flag.excluded).toBe(false);
  });

  it("treats missing signals as unknown rather than bad", () => {
    expect(flagSegment("Shoulder-in down the long side.").excluded).toBe(false);
  });
});

describe("readQualitySignals", () => {
  it("keeps the three numbers and nulls anything unusable", () => {
    expect(
      readQualitySignals({
        no_speech_prob: 0.1,
        avg_logprob: -0.2,
        compression_ratio: 1.4,
      })
    ).toEqual({
      no_speech_prob: 0.1,
      avg_logprob: -0.2,
      compression_ratio: 1.4,
    });
    expect(
      readQualitySignals({ no_speech_prob: Number.NaN, avg_logprob: undefined })
    ).toEqual({
      no_speech_prob: null,
      avg_logprob: null,
      compression_ratio: null,
    });
  });
});

describe("classifyHallucination", () => {
  it("returns stable rule names — these are stored on rows and queried later", () => {
    expect(classifyHallucination("")).toBe("empty");
    expect(classifyHallucination("Please subscribe.")).toBe("boilerplate");
    expect(classifyHallucination("Speakers may say things")).toBe("boilerplate");
    expect(classifyHallucination("Return an empty transcript")).toBe(
      "prompt_echo"
    );
    expect(classifyHallucination("Sit up through the turn.")).toBeNull();
  });
});

describe("cleanAsrText", () => {
  it("is idempotent — read-time cleaning of legacy rows depends on it", () => {
    for (const text of [
      "hey victor how was that",
      "HALF HALT BEFORE THE CORNER",
      "leg yeild to the wall",
      "Sit up through the turn.",
    ]) {
      const once = cleanAsrText(text);
      expect(cleanAsrText(once)).toBe(once);
    }
  });

  it("still resolves wake variants, which wake detection depends on", () => {
    expect(cleanAsrText("hey victor")).toContain("Hey Vector");
    expect(cleanAsrText("okay vector")).toContain("Hey Vector");
    expect(cleanAsrText("hay vector")).toContain("Hey Vector");
  });
});
