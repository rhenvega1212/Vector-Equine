import {
  calculateLessonProgress,
  calculateModuleProgress,
  isLessonComplete,
  type BlockProgress,
  type LessonGatingConfig,
  type LessonProgressData,
} from "../lib/challenges/gating";

function block(
  overrides: Partial<BlockProgress> = {}
): BlockProgress {
  return {
    blockId: crypto.randomUUID(),
    blockType: "rich_text",
    isRequired: true,
    isCompleted: false,
    ...overrides,
  };
}

function makeProgress(
  overrides: Partial<LessonProgressData> = {}
): LessonProgressData {
  return {
    lessonId: "lesson-1",
    blocks: [],
    discussionPostCount: 0,
    submissionStatus: null,
    manuallyApproved: false,
    ...overrides,
  };
}

describe("calculateLessonProgress", () => {
  it("returns 100% when there are no required blocks", () => {
    const result = calculateLessonProgress([
      block({ isRequired: false, isCompleted: false }),
    ]);
    expect(result.percent).toBe(100);
    expect(result.requiredTotal).toBe(0);
  });

  it("returns 100% when all required blocks are complete", () => {
    const result = calculateLessonProgress([
      block({ isRequired: true, isCompleted: true }),
      block({ isRequired: true, isCompleted: true }),
    ]);
    expect(result.percent).toBe(100);
    expect(result.requiredComplete).toBe(2);
    expect(result.requiredTotal).toBe(2);
  });

  it("returns correct percentage for partially completed required blocks", () => {
    const result = calculateLessonProgress([
      block({ isRequired: true, isCompleted: true }),
      block({ isRequired: true, isCompleted: false }),
      block({ isRequired: true, isCompleted: false }),
      block({ isRequired: true, isCompleted: true }),
    ]);
    expect(result.percent).toBe(50);
    expect(result.requiredComplete).toBe(2);
    expect(result.requiredTotal).toBe(4);
  });

  it("non-required blocks do not affect required progress", () => {
    const result = calculateLessonProgress([
      block({ isRequired: true, isCompleted: true }),
      block({ isRequired: false, isCompleted: false }),
      block({ isRequired: false, isCompleted: false }),
    ]);
    expect(result.percent).toBe(100);
    expect(result.requiredTotal).toBe(1);
    expect(result.requiredComplete).toBe(1);
  });
});

describe("calculateModuleProgress", () => {
  it("returns 100% when there are no lessons", () => {
    const result = calculateModuleProgress([]);
    expect(result.percent).toBe(100);
    expect(result.lessonsTotal).toBe(0);
  });

  it("returns 100% when all lessons are complete", () => {
    const result = calculateModuleProgress([
      { isComplete: true },
      { isComplete: true },
      { isComplete: true },
    ]);
    expect(result.percent).toBe(100);
    expect(result.lessonsComplete).toBe(3);
  });

  it("returns correct percentage for partially completed lessons", () => {
    const result = calculateModuleProgress([
      { isComplete: true },
      { isComplete: false },
    ]);
    expect(result.percent).toBe(50);
    expect(result.lessonsComplete).toBe(1);
    expect(result.lessonsTotal).toBe(2);
  });
});

describe("isLessonComplete", () => {
  it("without gating rules, complete when all required blocks done", () => {
    const config: LessonGatingConfig = {
      gatingType: "none",
      gatingRules: {},
    };
    const progress = makeProgress({
      blocks: [
        block({ isRequired: true, isCompleted: true }),
        block({ isRequired: false, isCompleted: false }),
      ],
    });
    expect(isLessonComplete(config, progress)).toBe(true);
  });

  it("without gating rules, incomplete when required blocks remain", () => {
    const config: LessonGatingConfig = {
      gatingType: "none",
      gatingRules: {},
    };
    const progress = makeProgress({
      blocks: [
        block({ isRequired: true, isCompleted: false }),
      ],
    });
    expect(isLessonComplete(config, progress)).toBe(false);
  });

  it("with gating rules, evaluates all rules and returns true when all met", () => {
    const config: LessonGatingConfig = {
      gatingType: "hard",
      gatingRules: {
        requireAllBlocks: true,
        requireSubmission: true,
      },
    };
    const progress = makeProgress({
      blocks: [
        block({ isRequired: true, isCompleted: true }),
      ],
      submissionStatus: "feedback_delivered",
    });
    expect(isLessonComplete(config, progress)).toBe(true);
  });

  it("with gating rules, returns false when any rule is unmet", () => {
    const config: LessonGatingConfig = {
      gatingType: "hard",
      gatingRules: {
        requireAllBlocks: true,
        requireSubmission: true,
      },
    };
    const progress = makeProgress({
      blocks: [
        block({ isRequired: true, isCompleted: true }),
      ],
      submissionStatus: "submitted",
    });
    expect(isLessonComplete(config, progress)).toBe(false);
  });
});
