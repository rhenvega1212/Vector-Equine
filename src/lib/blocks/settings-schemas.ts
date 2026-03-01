import { z } from "zod";

export const richTextSettingsSchema = z.object({}).default({});

export const imageSettingsSchema = z.object({
  caption: z.string().optional(),
  alignment: z.enum(["full", "left", "right"]).default("full"),
  allowEnlarge: z.boolean().default(true),
});

export const videoSettingsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  trackCompletion: z.boolean().default(false),
});

export const fileSettingsSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
});

export const discussionSettingsSchema = z.object({
  prompt: z.string().optional(),
  sortDefault: z.enum(["newest", "top"]).default("newest"),
  minParticipation: z.number().int().min(0).default(0),
});

export const submissionSettingsSchema = z.object({
  submissionType: z.enum(["video", "image", "text", "mixed"]).default("text"),
  instructions: z.string().optional(),
  rubric: z.string().optional(),
  maxFiles: z.number().int().min(1).default(3),
  allowResubmission: z.boolean().default(true),
  aiFeedbackEnabled: z.boolean().default(false),
  trainerOptions: z
    .array(
      z.object({
        trainerId: z.string().uuid(),
        priceAmount: z.number().int().min(0),
        turnaroundDays: z.number().int().min(1),
      })
    )
    .default([]),
});

export const quizSettingsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
        correctIndex: z.number().int().min(0),
        explanation: z.string().optional(),
      })
    )
    .default([]),
  passingPercent: z.number().min(0).max(100).default(70),
});

export const checklistSettingsSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        required: z.boolean().default(false),
      })
    )
    .default([]),
});

export const downloadSettingsSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
});

export const calloutSettingsSchema = z.object({
  calloutType: z.enum(["tip", "warning", "info", "key_point"]).default("tip"),
});

export const dividerSettingsSchema = z.object({});

export const trainerLinkSettingsSchema = z.object({
  trainers: z
    .array(
      z.object({
        trainerId: z.string().uuid(),
        ctaText: z.string().optional(),
      })
    )
    .default([]),
});

export const settingsSchemaMap = {
  rich_text: richTextSettingsSchema,
  image: imageSettingsSchema,
  video: videoSettingsSchema,
  file: fileSettingsSchema,
  discussion: discussionSettingsSchema,
  submission: submissionSettingsSchema,
  quiz: quizSettingsSchema,
  checklist: checklistSettingsSchema,
  download: downloadSettingsSchema,
  callout: calloutSettingsSchema,
  divider: dividerSettingsSchema,
  trainer_link: trainerLinkSettingsSchema,
} as const;
