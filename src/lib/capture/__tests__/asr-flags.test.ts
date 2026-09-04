import { describe, expect, it } from "vitest";
import {
  classifyHallucination,
  cleanAsrText,
  displayTranscriptText,
} from "@/lib/capture/asr-cleanup";
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

  it("keeps short timing markers, including the old crumb list", () => {
    for (const text of ["Now.", "There.", "Softer.", "Not yet.", "Again.", "No.", "Yes.", "Yeah", "That"]) {
      expect(flagSegment(text).excluded, text).toBe(false);
    }
  });

  it("does not flag a stacked gait list — vocab_dump is retired", () => {
    expect(
      flagSegment("Walk, trot, canter, halt, half-halt, inside leg.").excluded
    ).toBe(false);
  });

  it("does not flag a long line that happens to say transcript", () => {
    expect(
      flagSegment(
        "Lots of coding I'm trying to get like a transcript going so like when I am having a conversation with my trainer"
      ).excluded
    ).toBe(false);
  });

  it("flags Whisper boilerplate with a named reason", () => {
    expect(flagSegment("Thanks for watching.").reason).toBe(
      "hallucination:boilerplate"
    );
    expect(flagSegment("Transcribe only clear speech.").reason).toBe(
      "hallucination:boilerplate"
    );
  });

  it("flags a whole-segment prompt echo, not a human quoting the phrase", () => {
    expect(flagSegment("Thanks for watching!").reason).toBe(
      "hallucination:prompt_echo"
    );
    expect(flagSegment("Return an empty transcript").reason).toBe(
      "hallucination:prompt_echo"
    );
    expect(
      flagSegment(
        "This whisper looks like it's just saying thank you for watching over and over."
      ).excluded
    ).toBe(false);
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

  it("names blank input empty without calling it a hallucination", () => {
    expect(flagSegment("   ")).toEqual({ excluded: true, reason: "empty" });
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
    expect(classifyHallucination("")).toBeNull();
    expect(classifyHallucination("Please subscribe.")).toBe("boilerplate");
    expect(classifyHallucination("Speakers may say things")).toBe("boilerplate");
    expect(classifyHallucination("Return an empty transcript")).toBe(
      "prompt_echo"
    );
    expect(classifyHallucination("Sit up through the turn.")).toBeNull();
    expect(classifyHallucination("No.")).toBeNull();
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

  it("never blanks a real utterance, including ones classification flags", () => {
    expect(cleanAsrText("No.")).toBe("No.");
    expect(cleanAsrText("Thanks for watching.")).toBe("Thanks for watching.");
    expect(
      cleanAsrText(
        "This whisper looks like it's just saying thank you for watching over and over."
      ).length
    ).toBeGreaterThan(0);
  });

  it("does not return empty when the input had words", () => {
    expect(cleanAsrText("Yes").trim().length).toBeGreaterThan(0);
  });
});

describe("displayTranscriptText", () => {
  it("prefers the cleaned column, then tidy, then verbatim", () => {
    expect(displayTranscriptText("haunches in", "haunches-in")).toBe(
      "haunches-in"
    );
    expect(displayTranscriptText("haunches in")).toBe("haunches-in");
    expect(displayTranscriptText("No.")).toBe("No.");
  });
});
