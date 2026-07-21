import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireFeatureFlag } from "@/lib/flags/guards";
import { getCurrentProfile } from "@/lib/auth/current-profile";
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

  const { profile } = await getCurrentProfile();
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const onSetup = pathname.startsWith("/train/setup");

  if (needsVectorSetup(profile) && !onSetup) {
    redirect("/train/setup");
  }

  if (profile && !needsVectorSetup(profile) && onSetup) {
    redirect("/train");
  }

  return <TrainLayoutClient>{children}</TrainLayoutClient>;
}
