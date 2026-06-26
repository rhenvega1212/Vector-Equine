import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURE_FLAGS, FEATURE_FLAG_KEYS } from "@/lib/flags/registry";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication required", status: 401 as const };

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role?: string } | null };

  if (profile?.role !== "admin") {
    return { error: "Admin access required", status: 403 as const };
  }
  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();

  // Ensure every flag known to the codebase has a DB row (no-op on existing).
  const seedRows = FEATURE_FLAG_KEYS.map((key) => ({
    key,
    description: FEATURE_FLAGS[key].description,
    stage: FEATURE_FLAGS[key].defaultStage,
  }));
  await admin
    .from("feature_flags")
    .upsert(seedRows, { onConflict: "key", ignoreDuplicates: true });

  const { data: flags, error } = await admin
    .from("feature_flags")
    .select("*")
    .order("key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ flags: flags ?? [] });
}
