import { createClient } from "@/lib/supabase/server";
import type { UserRole, Profile } from "@/types/database";

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "You don't have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  
  return profile;
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile();
  
  if (!profile) {
    throw new AuthError("Authentication required");
  }
  
  return profile;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<Profile> {
  const profile = await requireAuth();
  
  if (!allowedRoles.includes(profile.role)) {
    throw new ForbiddenError(`This action requires one of the following roles: ${allowedRoles.join(", ")}`);
  }
  
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  return requireRole(["admin"]);
}

export async function requireTrainerApproved(): Promise<Profile> {
  const profile = await requireAuth();
  
  if (profile.role !== "admin" && (profile.role !== "trainer" || !profile.trainer_approved)) {
    throw new ForbiddenError("This action requires an approved trainer or admin account");
  }
  
  return profile;
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

export function isTrainer(profile: Profile | null): boolean {
  return profile?.role === "trainer";
}

export function isApprovedTrainer(profile: Profile | null): boolean {
  return profile?.role === "trainer" && profile.trainer_approved === true;
}

export function canCreateEvents(profile: Profile | null): boolean {
  return isAdmin(profile) || isApprovedTrainer(profile);
}

export function canCreateChallenges(profile: Profile | null): boolean {
  // Only admins can create challenges in MVP
  return isAdmin(profile);
}

export function canModerateContent(profile: Profile | null): boolean {
  return isAdmin(profile);
}
