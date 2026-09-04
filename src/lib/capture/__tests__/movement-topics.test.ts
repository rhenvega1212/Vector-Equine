import { describe, expect, it } from "vitest";
import { cleanAsrText } from "@/lib/capture/asr-cleanup";
import {
  isExerciseAskNeedingMovement,
  isMovementNameUtterance,
  isOffTopicReply,
  primaryMovementTopic,
} from "@/lib/capture/movement-topics";

describe("primaryMovementTopic", () => {
  it("reads shoulder-in through ASR stutter", () => {
    const topic = primaryMovementTopic("Shoulder-shoulder-in.");
    expect(topic?.key).toBe("shoulder-in");
  });

  it("reads the movement after an exercise ask", () => {
    const topic = primaryMovementTopic(
      "give me exercises Shoulder-shoulder-in"
    );
    expect(topic?.key).toBe("shoulder-in");
  });
});

describe("isExerciseAskNeedingMovement", () => {
  it("holds a bare exercise ask", () => {
    expect(isExerciseAskNeedingMovement("give me exercises")).toBe(true);
    expect(isExerciseAskNeedingMovement("give me an exercise")).toBe(true);
  });

  it("lets the ask through once a movement is named", () => {
    expect(
      isExerciseAskNeedingMovement("give me exercises for shoulder-in")
    ).toBe(false);
    expect(isExerciseAskNeedingMovement("shoulder-in")).toBe(false);
  });
});

describe("isMovementNameUtterance", () => {
  it("treats a short movement name as a follow-up", () => {
    expect(isMovementNameUtterance("Shoulder-in.")).toBe(true);
    expect(isMovementNameUtterance("leg yield")).toBe(true);
  });
});

describe("isOffTopicReply", () => {
  const shoulder = primaryMovementTopic("shoulder-in")!;

  it("rejects a 20m circle warmup for shoulder-in", () => {
    expect(
      isOffTopicReply(
        "Generally — 1. Walk a 20-meter circle, focus on even tempo. 2. Trot the same circle. 3. Canter one lap.",
        shoulder
      )
    ).toBe(true);
  });

  it("accepts an exercise that names shoulder-in", () => {
    expect(
      isOffTopicReply(
        "Generally — 10m circle at the letter. Keep the bend and ride forward — that's shoulder-in. Inside leg to outside rein. Three or four steps.",
        shoulder
      )
    ).toBe(false);
  });
});

describe("cleanAsrText", () => {
  it("collapses shoulder-shoulder-in", () => {
    expect(cleanAsrText("Shoulder-shoulder-in.")).toMatch(/shoulder-in/i);
  });
});
