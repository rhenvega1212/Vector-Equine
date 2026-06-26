import type { FlagStage } from "@/types/database";

/**
 * Canonical list of feature flags known to the codebase.
 *
 * The *live* stage/rollout for each flag lives in the `feature_flags` DB table
 * (so it can be changed from the admin panel with no redeploy). This registry
 * defines the typed keys + human descriptions + the stage a flag should fall
 * back to if its DB row is missing.
 *
 * To add a new gated feature: add a key here, then add a matching seed row in a
 * migration (or it will be auto-seeded by the admin flags sync endpoint).
 */
export const FEATURE_FLAGS = {
  training_diary: {
    description:
      "Training diary, horses, sessions & insights (the Train workspace)",
    defaultStage: "off" as FlagStage,
  },
  ai_video_analysis: {
    description: "AI video analysis of training sessions",
    defaultStage: "off" as FlagStage,
  },
  ai_highlight_reel: {
    description: "AI-generated highlight reels",
    defaultStage: "off" as FlagStage,
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
