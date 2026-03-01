import {
  evaluateGating,
  type LessonGatingConfig,
  type LessonProgressData,
} from "../lib/challenges/gating";

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

function makeConfig(
  overrides: Partial<LessonGatingConfig> = {}
): LessonGatingConfig {
  return {
    gatingType: "hard",
    gatingRules: {},
    ...overrides,
  };
}

describe("evaluateGating", () => {
  it("returns canProceed with no unmet requirements when gating type is none", () => {
    const result = evaluateGating(
      makeConfig({ gatingType: "none", gatingRules: { requireAllBlocks: true } }),
      makeProgress()
    );
    expect(result.canProceed).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);
  });

  it("soft gating with unmet requirements still allows proceeding", () => {
    const result = evaluateGating(
      makeConfig({
        gatingType: "soft",
        gatingRules: { requireAllBlocks: true },
      }),
      makeProgress({
        blocks: [
          { blockId: "b1", blockType: "rich_text", isRequired: true, isCompleted: false },
        ],
      })
    );
    expect(result.canProceed).toBe(true);
    expect(result.unmetRequirements.length).toBeGreaterThan(0);
  });

  it("hard gating with all requirements met allows proceeding", () => {
    const result = evaluateGating(
      makeConfig({
        gatingType: "hard",
        gatingRules: {
          requireAllBlocks: true,
          requireSubmission: true,
          minDiscussionPosts: 2,
          requireManualApproval: true,
        },
      }),
      makeProgress({
        blocks: [
          { blockId: "b1", blockType: "rich_text", isRequired: true, isCompleted: true },
          { blockId: "b2", blockType: "video", isRequired: true, isCompleted: true },
        ],
        submissionStatus: "feedback_delivered",
        discussionPostCount: 3,
        manuallyApproved: true,
      })
    );
    expect(result.canProceed).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);
  });

  it("hard gating with requireAllBlocks unmet blocks proceeding", () => {
    const result = evaluateGating(
      makeConfig({
        gatingType: "hard",
        gatingRules: { requireAllBlocks: true },
      }),
      makeProgress({
        blocks: [
          { blockId: "b1", blockType: "rich_text", isRequired: true, isCompleted: false },
          { blockId: "b2", blockType: "video", isRequired: true, isCompleted: true },
          { blockId: "b3", blockType: "image", isRequired: false, isCompleted: false },
        ],
      })
    );
    expect(result.canProceed).toBe(false);
    expect(result.unmetRequirements).toHaveLength(1);
    expect(result.unmetRequirements[0]).toMatch(/complete all required blocks/i);
  });

  it("hard gating with requireSubmission unmet blocks proceeding", () => {
    const result = evaluateGating(
      makeConfig({
        gatingType: "hard",
        gatingRules: { requireSubmission: true },
      }),
      makeProgress({ submissionStatus: "submitted" })
    );
    expect(result.canProceed).toBe(false);
    expect(result.unmetRequirements).toHaveLength(1);
    expect(result.unmetRequirements[0]).toMatch(/submit/i);
  });

  it("hard gating with minDiscussionPosts unmet blocks proceeding", () => {
    const result = evaluateGating(
      makeConfig({
        gatingType: "hard",
        gatingRules: { minDiscussionPosts: 3 },
      }),
      makeProgress({ discussionPostCount: 1 })
    );
    expect(result.canProceed).toBe(false);
    expect(result.unmetRequirements).toHaveLength(1);
    expect(result.unmetRequirements[0]).toMatch(/2 more discussion comments/);
  });

  it("hard gating with requireManualApproval unmet blocks proceeding", () => {
    const result = evaluateGating(
      makeConfig({
        gatingType: "hard",
        gatingRules: { requireManualApproval: true },
      }),
      makeProgress({ manuallyApproved: false })
    );
    expect(result.canProceed).toBe(false);
    expect(result.unmetRequirements).toHaveLength(1);
    expect(result.unmetRequirements[0]).toMatch(/manual approval/i);
  });

  it("hard gating with multiple unmet requirements lists all of them", () => {
    const result = evaluateGating(
      makeConfig({
        gatingType: "hard",
        gatingRules: {
          requireAllBlocks: true,
          requireSubmission: true,
          minDiscussionPosts: 1,
          requireManualApproval: true,
        },
      }),
      makeProgress({
        blocks: [
          { blockId: "b1", blockType: "quiz", isRequired: true, isCompleted: false },
        ],
        submissionStatus: null,
        discussionPostCount: 0,
        manuallyApproved: false,
      })
    );
    expect(result.canProceed).toBe(false);
    expect(result.unmetRequirements).toHaveLength(4);
  });
});
