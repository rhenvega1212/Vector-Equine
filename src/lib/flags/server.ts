import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  allFlagsOff,
  type EvaluatedFlags,
  type FeatureFlagKey,
} from "./registry";
import { evaluateFlag } from "./evaluate";

type FlagRow = {
  key: string;
  stage: string;
  rollout_percentage: number;
};

/**
 * Resolve every known feature flag for a given viewer (by their profile).
 * Cached per request — main layout + train guards share one flag load.
 */
export const getFlagsForProfile = cache(
  async (
    profile: Pick<Profile, "id" | "role" | "is_beta_tester"> | null
  ): Promise<EvaluatedFlags> => {
    if (!profile) return allFlagsOff();

    try {
      const supabase = await createClient();

      const [{ data: flagRows }, { data: overrideRows }] = await Promise.all([
        supabase.from("feature_flags").select("key, stage, rollout_percentage"),
        supabase
          .from("feature_flag_overrides")
          .select("flag_key, enabled")
          .eq("user_id", profile.id),
      ]);

      const byKey = new Map<string, FlagRow>(
        ((flagRows ?? []) as FlagRow[]).map((r) => [r.key, r])
      );
      const overrideByKey = new Map<string, boolean>(
        (
          (overrideRows ?? []) as { flag_key: string; enabled: boolean }[]
        ).map((r) => [r.flag_key, r.enabled])
      );

      const result = {} as EvaluatedFlags;
      for (const key of FEATURE_FLAG_KEYS) {
        const row = byKey.get(key);
        const stage = (row?.stage ??
          FEATURE_FLAGS[key].defaultStage) as FlagRow["stage"];
        result[key] = evaluateFlag({
          flagKey: key,
          userId: profile.id,
          role: profile.role,
          isBetaTester: profile.is_beta_tester ?? false,
          override: overrideByKey.get(key),
          stage: stage as never,
          rolloutPercentage: row?.rollout_percentage ?? 0,
        });
      }
      return result;
    } catch {
      return allFlagsOff();
    }
  }
);

/** Convenience: is a single flag enabled for this profile? */
export async function isFlagEnabled(
  flag: FeatureFlagKey,
  profile: Pick<Profile, "id" | "role" | "is_beta_tester"> | null
): Promise<boolean> {
  const flags = await getFlagsForProfile(profile);
  return flags[flag];
}
