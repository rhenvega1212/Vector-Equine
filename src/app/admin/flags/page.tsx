import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { FEATURE_FLAGS, FEATURE_FLAG_KEYS } from "@/lib/flags/registry";
import { FlagControlPanel } from "@/components/admin/flag-control-panel";
import type { FeatureFlag } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role?: string } | null };
  if (profile?.role !== "admin") redirect("/feed");

  const admin = createAdminClient();

  // Make sure every flag in the registry has a row to control.
  const seedRows = FEATURE_FLAG_KEYS.map((key) => ({
    key,
    description: FEATURE_FLAGS[key].description,
    stage: FEATURE_FLAGS[key].defaultStage,
  }));
  await admin
    .from("feature_flags")
    .upsert(seedRows, { onConflict: "key", ignoreDuplicates: true });

  const { data: flags } = await admin
    .from("feature_flags")
    .select("*")
    .order("key");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Feature Flags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roll features up the ladder: <strong>Off</strong> → Internal (team) →
          Closed beta (beta testers) → Open beta (% rollout) → GA (everyone).
          Changes take effect immediately — no redeploy.
        </p>
      </div>
      <FlagControlPanel initialFlags={(flags ?? []) as FeatureFlag[]} />
    </div>
  );
}
