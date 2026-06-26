import { requireFeatureFlag } from "@/lib/flags/guards";
import { TrainLayoutClient } from "./train-layout-client";

// Re-evaluate the flag on every request so stage/cohort changes take effect.
export const dynamic = "force-dynamic";

export default async function TrainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFeatureFlag("training_diary");

  return <TrainLayoutClient>{children}</TrainLayoutClient>;
}
