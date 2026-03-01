export interface GatingRules {
  requireAllBlocks?: boolean;
  requireSubmission?: boolean;
  minDiscussionPosts?: number;
  requireManualApproval?: boolean;
}

export type GatingType = "none" | "soft" | "hard";

export interface LessonGatingConfig {
  gatingType: GatingType;
  gatingRules: GatingRules;
}

export interface BlockProgress {
  blockId: string;
  blockType: string;
  isRequired: boolean;
  isCompleted: boolean;
}

export interface LessonProgressData {
  lessonId: string;
  blocks: BlockProgress[];
  discussionPostCount: number;
  submissionStatus: string | null;
  manuallyApproved: boolean;
}

export interface GatingResult {
  canProceed: boolean;
  unmetRequirements: string[];
}

export interface LessonProgress {
  percent: number;
  requiredComplete: number;
  requiredTotal: number;
}

export interface ModuleProgress {
  percent: number;
  lessonsComplete: number;
  lessonsTotal: number;
}

export function evaluateGating(
  config: LessonGatingConfig,
  progress: LessonProgressData
): GatingResult {
  if (config.gatingType === "none") {
    return { canProceed: true, unmetRequirements: [] };
  }

  const unmetRequirements: string[] = [];
  const { gatingRules } = config;

  if (gatingRules.requireAllBlocks) {
    const incomplete = progress.blocks.filter(
      (b) => b.isRequired && !b.isCompleted
    );
    if (incomplete.length > 0) {
      unmetRequirements.push(
        `Complete all required blocks (${incomplete.length} remaining)`
      );
    }
  }

  if (gatingRules.requireSubmission) {
    if (progress.submissionStatus !== "feedback_delivered") {
      unmetRequirements.push(
        "Submit your work and receive feedback before proceeding"
      );
    }
  }

  if (
    gatingRules.minDiscussionPosts != null &&
    gatingRules.minDiscussionPosts > 0
  ) {
    if (progress.discussionPostCount < gatingRules.minDiscussionPosts) {
      const remaining =
        gatingRules.minDiscussionPosts - progress.discussionPostCount;
      unmetRequirements.push(
        `Post at least ${remaining} more discussion ${remaining === 1 ? "comment" : "comments"}`
      );
    }
  }

  if (gatingRules.requireManualApproval) {
    if (!progress.manuallyApproved) {
      unmetRequirements.push(
        "Awaiting manual approval from your instructor"
      );
    }
  }

  const canProceed =
    config.gatingType === "soft" || unmetRequirements.length === 0;

  return { canProceed, unmetRequirements };
}

export function calculateLessonProgress(
  blocks: BlockProgress[]
): LessonProgress {
  const required = blocks.filter((b) => b.isRequired);
  const requiredTotal = required.length;
  const requiredComplete = required.filter((b) => b.isCompleted).length;
  const percent = requiredTotal === 0 ? 100 : (requiredComplete / requiredTotal) * 100;

  return { percent, requiredComplete, requiredTotal };
}

export function calculateModuleProgress(
  lessons: { isComplete: boolean }[]
): ModuleProgress {
  const lessonsTotal = lessons.length;
  const lessonsComplete = lessons.filter((l) => l.isComplete).length;
  const percent = lessonsTotal === 0 ? 100 : (lessonsComplete / lessonsTotal) * 100;

  return { percent, lessonsComplete, lessonsTotal };
}

export function isLessonComplete(
  config: LessonGatingConfig,
  progress: LessonProgressData
): boolean {
  const hasRules =
    config.gatingRules.requireAllBlocks ||
    config.gatingRules.requireSubmission ||
    (config.gatingRules.minDiscussionPosts != null &&
      config.gatingRules.minDiscussionPosts > 0) ||
    config.gatingRules.requireManualApproval;

  if (!hasRules) {
    return progress.blocks
      .filter((b) => b.isRequired)
      .every((b) => b.isCompleted);
  }

  const result = evaluateGating(
    { gatingType: "hard", gatingRules: config.gatingRules },
    progress
  );

  return result.unmetRequirements.length === 0;
}
