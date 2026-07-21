import type { Profile } from "@/types/database";

type SetupProfile = Pick<
  Profile,
  "role_rider" | "role_trainer" | "vector_setup_completed_at"
>;

/** Riders must finish Vector setup before the Loop; coach-only skip. */
export function needsVectorSetup(profile: SetupProfile | null | undefined): boolean {
  if (!profile) return false;
  if (!profile.role_rider) return false;
  return profile.vector_setup_completed_at == null;
}

export function isCoachOnly(profile: SetupProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.role_trainer === true && profile.role_rider !== true;
}
