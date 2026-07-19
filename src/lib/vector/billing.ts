import { createClient } from "@/lib/supabase/server";
import { VECTOR_CONFIG, TRAINER_BUSINESS_SKU } from "@/lib/vector/config";

export { TRAINER_BUSINESS_SKU };

export async function hasActiveRiderSubscription(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function assertCanCaptureSession(
  userId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!VECTOR_CONFIG.RIDER_PAYWALL) {
    return { ok: true };
  }

  const active = await hasActiveRiderSubscription(userId);
  if (active) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      "An active rider subscription is required to capture sessions. Coaching and browsing stay free.",
  };
}

export async function getCoachRosterCount(trainerId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("coach_connections")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", trainerId)
    .eq("status", "active");

  return count ?? 0;
}

export function isAtFreeCoachCap(count: number): boolean {
  return count >= VECTOR_CONFIG.FREE_COACH_MAX_RIDERS;
}
