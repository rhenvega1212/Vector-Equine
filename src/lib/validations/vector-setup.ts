import { z } from "zod";

export const HEALTH_FLAG_KEYS = [
  "recent_soundness_concern",
  "back_or_saddle_sensitivity",
  "known_prior_injury",
  "time_off_recent",
  "other",
] as const;

export type HealthFlagKey = (typeof HEALTH_FLAG_KEYS)[number];

export const HEALTH_FLAG_LABELS: Record<HealthFlagKey, string> = {
  recent_soundness_concern: "Recent soundness concern",
  back_or_saddle_sensitivity: "Back or saddle sensitivity",
  known_prior_injury: "Known prior injury still in play",
  time_off_recent: "Time off recently",
  other: "Something else worth flagging",
};

export const vectorSetupSchema = z.object({
  discipline: z.string().min(1, "Select your discipline"),
  rider_level: z.string().min(1, "Select your rider level"),
  horse: z.object({
    name: z.string().min(1, "Horse name is required").max(120),
    breed: z.string().max(120).optional().nullable(),
    age: z.number().int().min(0).max(50).optional().nullable(),
    sex: z.string().max(20).optional().nullable(),
    discipline: z.string().min(1, "Select horse discipline").max(80),
    training_level: z.string().min(1, "Training level is required").max(80),
    goals: z.string().max(2000).optional().nullable(),
    injuries_limitations: z.string().max(1000).optional().nullable(),
    months_together: z.number().int().min(0).max(600),
    sessions_per_week: z.number().int().min(1).max(14),
    current_focus: z.string().min(1, "What are you working on?").max(200),
    sticking_points: z.string().max(1000).optional().nullable(),
    health_flags: z.array(z.enum(HEALTH_FLAG_KEYS)).default([]),
    health_flag_notes: z.string().max(1000).optional().nullable(),
  }),
});

export type VectorSetupInput = z.infer<typeof vectorSetupSchema>;
