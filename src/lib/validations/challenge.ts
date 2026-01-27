import { z } from "zod";

export const difficultyEnum = z.enum(["beginner", "intermediate", "advanced"]);
export const challengeStatusEnum = z.enum(["draft", "published"]);
export const contentBlockTypeEnum = z.enum(["rich_text", "image", "video", "file"]);
export const submissionTypeEnum = z.enum(["text", "image", "video", "link"]);

export const createChallengeSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z.string().max(5000, "Description must be less than 5000 characters").optional(),
  difficulty: difficultyEnum.optional(),
  duration_days: z.number().int().positive("Duration must be a positive number").optional(),
  price_display: z.string().max(50, "Price display must be less than 50 characters").optional(),
  cover_image_url: z.string().url("Invalid cover image URL").optional(),
  status: challengeStatusEnum.optional(),
  is_private: z.boolean().optional(),
});

export const updateChallengeSchema = createChallengeSchema.partial();

export const createModuleSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateModuleSchema = createModuleSchema.partial();

export const createLessonSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  requires_submission: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateLessonSchema = createLessonSchema.partial();

export const createContentBlockSchema = z.object({
  block_type: contentBlockTypeEnum,
  content: z.string().optional(),
  file_name: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateContentBlockSchema = createContentBlockSchema.partial();

export const createAssignmentSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(100, "Title must be less than 100 characters"),
  instructions: z.string().max(2000, "Instructions must be less than 2000 characters").optional(),
  submission_type: submissionTypeEnum,
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

export const createSubmissionSchema = z.object({
  content: z.string().max(5000, "Content must be less than 5000 characters").optional(),
  media_url: z.string().url("Invalid media URL").optional(),
});

export const submissionCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment is required")
    .max(1000, "Comment must be less than 1000 characters"),
});

export const adminFeedbackSchema = z.object({
  admin_feedback: z.string().max(2000, "Feedback must be less than 2000 characters").optional(),
  is_feedback_pinned: z.boolean().optional(),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type CreateContentBlockInput = z.infer<typeof createContentBlockSchema>;
export type UpdateContentBlockInput = z.infer<typeof updateContentBlockSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type SubmissionCommentInput = z.infer<typeof submissionCommentSchema>;
export type AdminFeedbackInput = z.infer<typeof adminFeedbackSchema>;
