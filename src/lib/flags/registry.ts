import type { FlagStage } from "@/types/database";

/**
 * Canonical list of feature flags known to the codebase.
 *
 * The *live* stage/rollout for each flag lives in the `feature_flags` DB table
 * (so it can be changed from the admin panel with no redeploy). This registry
 * defines the typed keys + human descriptions + the stage a flag should fall
 * back to if its DB row is missing.
 *
 * Flag-off means the surface is absent — never greyed "Coming soon".
 */
export const FEATURE_FLAGS = {
  training_diary: {
    description:
      "Vector workspace — Today, Horse room, Plan, Live, Debrief",
    defaultStage: "off" as FlagStage,
  },
  video_analysis: {
    description: "Plan / uploaded video analysis (Ask about a clip)",
    defaultStage: "off" as FlagStage,
  },
  highlight_reel: {
    description: "Generated highlight reels",
    defaultStage: "off" as FlagStage,
  },
  sensor_capture: {
    description: "Sensor-derived aid reads, decoded moments, sweet-spot UI",
    defaultStage: "off" as FlagStage,
  },
  horse_health: {
    description: "Load, recovery, symmetry — horse health surface",
    defaultStage: "off" as FlagStage,
  },
  events_shows: {
    description: "Events and shows",
    defaultStage: "off" as FlagStage,
  },
  trainer_business: {
    description: "Trainer Business back-office SKU (never gates coaching)",
    defaultStage: "off" as FlagStage,
  },
  coach_claim: {
    description: "Guest trainer claim after scan-in lesson",
    defaultStage: "ga" as FlagStage,
  },
  clinic_batch: {
    description: "Clinic multi-lesson claim batch screen",
    defaultStage: "internal" as FlagStage,
  },
  /** Brief 14 — open, close, called turns. Evaluated at session start (DB), not build-cached. */
  vector_in_session: {
    description:
      "Vector spoken presence in Live (open/close/called turns). Kill switch — flip without deploy",
    defaultStage: "internal" as FlagStage,
  },
  /** Brief 14 — blocking feel sheet only; independent of live session voice. */
  vector_feel_prompt: {
    description: "Blocking post-ride feel rating sheet (1–5)",
    defaultStage: "internal" as FlagStage,
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

/** A fully-resolved map of every known flag → enabled for the current viewer. */
export type EvaluatedFlags = Record<FeatureFlagKey, boolean>;

/** All flags off — safe default for logged-out users / failures. */
export function allFlagsOff(): EvaluatedFlags {
  return FEATURE_FLAG_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as EvaluatedFlags);
}
