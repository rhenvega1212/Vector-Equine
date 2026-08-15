import type { Profile } from "@/types/database";

type SetupProfile = Pick<
  Profile,
  "role_rider" | "role_trainer" | "vector_setup_completed_at"
>;

/**
 * Riders need at least one horse before the Loop.
 * Coach-only accounts skip. Wizard extras are optional later.
 */
export function needsVectorSetup(
  profile: SetupProfile | null | undefined,
  horseCount = 0
): boolean {
  if (!profile) return false;
  if (!profile.role_rider) return false;
  return horseCount === 0;
}

export function isCoachOnly(profile: SetupProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.role_trainer === true && profile.role_rider !== true;
}
