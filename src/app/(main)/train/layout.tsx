import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireFeatureFlag } from "@/lib/flags/guards";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { needsVectorSetup } from "@/lib/vector/setup-gate";
import { TrainLayoutClient } from "./train-layout-client";

// Re-evaluate the flag on every request so stage/cohort changes take effect.
export const dynamic = "force-dynamic";

export default async function TrainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFeatureFlag("training_diary");

  const { user, profile } = await getCurrentProfile();
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const onSetup = pathname.startsWith("/train/setup");

  let horseCount = 0;
  if (user && profile?.role_rider) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("horse_profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id);
    horseCount = count ?? 0;
  }

  if (needsVectorSetup(profile, horseCount) && !onSetup) {
    redirect("/train/setup");
  }

  if (profile && !needsVectorSetup(profile, horseCount) && onSetup) {
    redirect("/train");
  }

  return <TrainLayoutClient>{children}</TrainLayoutClient>;
}
