import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateClaimToken(): string {
  return randomBytes(32).toString("hex");
}

export function claimExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + CLAIM_TTL_MS).toISOString();
}

/** Upsert pending coach_connections from the capture flywheel. */
export async function upsertCaptureCoachConnection(
  admin: SupabaseClient,
  opts: { riderId: string; trainerId: string }
): Promise<{ id: string } | null> {
  if (opts.riderId === opts.trainerId) return null;

  const { data: existing } = await admin
    .from("coach_connections")
    .select("id, status")
    .eq("rider_id", opts.riderId)
    .eq("trainer_id", opts.trainerId)
    .maybeSingle();

  if (existing) {
    // Never downgrade an active link; revive declined/removed as pending.
    if (existing.status === "active" || existing.status === "pending") {
      return { id: existing.id };
    }
    const { data, error } = await admin
      .from("coach_connections")
      .update({
        status: "pending",
        initiated_by: "capture",
        share_scope: "shared_only",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) return null;
    return data;
  }

  const { data, error } = await admin
    .from("coach_connections")
    .insert({
      rider_id: opts.riderId,
      trainer_id: opts.trainerId,
      status: "pending",
      initiated_by: "capture",
      share_scope: "shared_only",
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data;
}
