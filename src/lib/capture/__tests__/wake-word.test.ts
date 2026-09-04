import { describe, expect, it } from "vitest";
import {
  isIntelligibleQuestion,
  isLikelyVectorEcho,
  splitWakeUtterance,
} from "@/lib/capture/wake-word";

describe("splitWakeUtterance", () => {
  it("hits Hey Vector and keeps the ask", () => {
    const { hit, residual } = splitWakeUtterance(
      "Hey Vector, how do I sit the trot?"
    );
    expect(hit).toBe(true);
    expect(residual.toLowerCase()).toContain("trot");
  });

  it("hits ASR mangling of the wake", () => {
    expect(splitWakeUtterance("hey victor how is the canter").hit).toBe(true);
    expect(splitWakeUtterance("okay vector").hit).toBe(true);
    expect(splitWakeUtterance("hay vector").hit).toBe(true);
  });

  it("does not treat the open bookend as a wake", () => {
    expect(
      splitWakeUtterance("Vector Equine. You're on. Capturing from here.").hit
    ).toBe(false);
  });
});

describe("isIntelligibleQuestion", () => {
  it("accepts a riding ask after the wake is stripped", () => {
    expect(isIntelligibleQuestion("how do I sit the trot")).toBe(true);
    expect(isIntelligibleQuestion("can you give me an exercise")).toBe(true);
    expect(isIntelligibleQuestion("shoulder-in")).toBe(true);
  });

  it("rejects a bare wake leftover", () => {
    expect(isIntelligibleQuestion("Hey Vector")).toBe(false);
    expect(isIntelligibleQuestion("vector")).toBe(false);
  });
});

describe("isLikelyVectorEcho", () => {
  it("drops a fragment of a short Vector line", () => {
    expect(isLikelyVectorEcho("Yes?", "Yes?")).toBe(true);
    expect(isLikelyVectorEcho("yes", "Yes?")).toBe(true);
  });

  it("does not swallow a question that happens to contain yes", () => {
    expect(
      isLikelyVectorEcho("yes how do I get a better trot", "Yes?")
    ).toBe(false);
  });

  it("does not swallow a question during Anything else", () => {
    expect(
      isLikelyVectorEcho("anything else for the left lead", "Anything else?")
    ).toBe(false);
  });

  it("drops a long Vector answer coming back through the mic", () => {
    const line =
      "Don't make the circle smaller. Make the canter smaller, same figure.";
    expect(isLikelyVectorEcho("make the canter smaller same figure", line)).toBe(
      true
    );
  });
});
