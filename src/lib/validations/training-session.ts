import { z } from "zod";

export const sessionTypeEnum = z.enum([
  "ride",
  "groundwork",
  "lesson",
  "hack",
  "conditioning",
  "other",
]);

export const createTrainingSessionSchema = z.object({
  session_date: z.string().min(1, "Date is required"),
  horse: z.string().min(1, "Horse is required").max(100),
  session_type: sessionTypeEnum,
  overall_feel: z.number().int().min(1).max(10),
  discipline: z.string().max(100).optional().nullable(),
  exercises: z.string().max(2000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  rhythm: z.number().int().min(1).max(5).optional().nullable(),
  relaxation: z.number().int().min(1).max(5).optional().nullable(),
  connection: z.number().int().min(1).max(5).optional().nullable(),
  impulsion: z.number().int().min(1).max(5).optional().nullable(),
  straightness: z.number().int().min(1).max(5).optional().nullable(),
  collection: z.number().int().min(1).max(5).optional().nullable(),
  competition_prep: z.boolean().optional(),
  focused_goal_session: z.boolean().optional(),
  video_link_url: z.string().url().optional().nullable().or(z.literal("")),
});

export const updateTrainingSessionSchema = createTrainingSessionSchema.partial();

export type CreateTrainingSessionInput = z.infer<typeof createTrainingSessionSchema>;
export type UpdateTrainingSessionInput = z.infer<typeof updateTrainingSessionSchema>;

export const SESSION_TYPE_LABELS: Record<string, string> = {
  ride: "Ride",
  groundwork: "Groundwork",
  lesson: "Lesson",
  hack: "Hack",
  conditioning: "Conditioning",
  other: "Other",
};
