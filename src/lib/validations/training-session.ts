import { z } from "zod";

export const sessionTypeEnum = z.enum([
  "flat_ride",
  "dressage",
  "jump_school",
  "trail_ride",
  "hack",
  "lunge",
  "groundwork",
  "lesson",
  "show",
  "conditioning",
  "rehab",
  "other",
  "ride", // legacy
]);

const trainingSessionBaseSchema = z.object({
  session_date: z.string().min(1, "Date is required"),
  horse_id: z.string().uuid().optional().nullable(),
  horse: z.string().max(100).optional().nullable(), // legacy / display when no horse_id
  session_title: z.string().max(200).optional().nullable(),
  session_type: sessionTypeEnum,
  duration_minutes: z.number().int().min(0).max(600).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  overall_feel: z.number().int().min(1).max(10),
  discipline: z.string().max(100).optional().nullable(),
  exercises: z.string().max(2000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  rhythm: z.number().int().min(1).max(5).optional().nullable(),
  relaxation: z.number().int().min(1).max(5).optional().nullable(),
  connection: z.number().int().min(1).max(5).optional().nullable(),
  impulsion: z.number().int().min(1).max(5).optional().nullable(),
  straightness: z.number().int().min(1).max(5).optional().nullable(),
  collection: z.number().int().min(1).max(5).optional().nullable(),
  ride_quality: z.number().int().min(1).max(5).optional().nullable(),
  horse_energy: z.number().int().min(1).max(5).optional().nullable(),
  responsiveness: z.number().int().min(1).max(5).optional().nullable(),
  balance: z.number().int().min(1).max(5).optional().nullable(),
  suppleness: z.number().int().min(1).max(5).optional().nullable(),
  rider_position: z.number().int().min(1).max(5).optional().nullable(),
  rider_effectiveness: z.number().int().min(1).max(5).optional().nullable(),
  focus: z.number().int().min(1).max(5).optional().nullable(),
  confidence: z.number().int().min(1).max(5).optional().nullable(),
  progress_today: z.number().int().min(1).max(5).optional().nullable(),
  soundness: z.number().int().min(1).max(5).optional().nullable(),
  stamina: z.number().int().min(1).max(5).optional().nullable(),
  behavior_attitude: z.number().int().min(1).max(5).optional().nullable(),
  competition_prep: z.boolean().optional(),
  focused_goal_session: z.boolean().optional(),
  video_link_url: z.string().url().optional().nullable().or(z.literal("")),
  video_upload_path: z.string().max(500).optional().nullable(),
  session_source: z.enum(["manual", "comms", "sensor", "hybrid"]).optional(),
  summary: z.string().max(10000).optional().nullable(),
  homework: z.string().max(10000).optional().nullable(),
  trainer_id: z.string().uuid().optional().nullable(),
});

export const createTrainingSessionSchema = trainingSessionBaseSchema.refine(
  (data) => data.horse_id != null || (data.horse != null && data.horse.trim().length > 0),
  { message: "Select a horse or enter horse name", path: ["horse_id"] }
);

export const updateTrainingSessionSchema = trainingSessionBaseSchema.partial();

export type CreateTrainingSessionInput = z.infer<typeof createTrainingSessionSchema>;
export type UpdateTrainingSessionInput = z.infer<typeof updateTrainingSessionSchema>;

export const SESSION_TYPE_LABELS: Record<string, string> = {
  flat_ride: "Flat ride",
  dressage: "Dressage",
  jump_school: "Jump school",
  trail_ride: "Trail ride",
  hack: "Hack",
  lunge: "Lunge",
  groundwork: "Groundwork",
  lesson: "Lesson",
  show: "Show",
  conditioning: "Conditioning",
  rehab: "Rehab",
  other: "Other",
  ride: "Ride",
};

export const QUICK_RATING_KEYS = [
  "ride_quality",
  "horse_energy",
  "relaxation",
  "responsiveness",
  "connection",
  "straightness",
  "balance",
  "suppleness",
  "rider_position",
  "rider_effectiveness",
  "focus",
  "confidence",
  "progress_today",
  "soundness",
  "stamina",
  "behavior_attitude",
] as const;

export const QUICK_RATING_LABELS: Record<string, string> = {
  ride_quality: "Ride quality",
  horse_energy: "Horse energy",
  relaxation: "Relaxation",
  responsiveness: "Responsiveness",
  connection: "Connection",
  straightness: "Straightness",
  balance: "Balance",
  suppleness: "Suppleness",
  rider_position: "Rider position",
  rider_effectiveness: "Rider effectiveness",
  focus: "Focus",
  confidence: "Confidence",
  progress_today: "Progress today",
  soundness: "Soundness",
  stamina: "Stamina",
  behavior_attitude: "Behavior / attitude",
};
