import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import type { Profile } from "@/types/database";
import { isFlagEnabled } from "./server";
import type { FeatureFlagKey } from "./registry";

/**
 * Server-component / layout guard. Redirects when the flag is not enabled for
 * the current (effective) viewer. Returns the effective profile on success.
 */
export async function requireFeatureFlag(
  flag: FeatureFlagKey,
  options?: { redirectTo?: string }
): Promise<Profile> {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile?.username) redirect("/onboarding");

  const enabled = await isFlagEnabled(flag, profile);
  if (!enabled) redirect(options?.redirectTo ?? "/feed");

  return profile;
}

/**
 * Route-handler guard. Returns a NextResponse to short-circuit when the flag is
 * not enabled (401 if logged out, 403 if gated), or null to continue. Respects
 * admin impersonation (evaluates against the effective viewer).
 */
export async function flagGuardForApi(
  flag: FeatureFlagKey
): Promise<NextResponse | null> {
  const { user, profile } = await getCurrentProfile();

  if (!user || !profile) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const enabled = await isFlagEnabled(flag, profile);
  if (!enabled) {
    return NextResponse.json(
      { error: "This feature is not available for your account." },
      { status: 403 }
    );
  }

  return null;
}
