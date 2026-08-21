import { requireFeatureFlag } from "@/lib/flags/guards";

/**
 * Plan and the clip-analysis routes under it are still demo content, so the
 * surface is absent rather than shown half-built. Covers /train/ride/plan and
 * every nested route in one place; the pages below are client components.
 */
export default async function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFeatureFlag("video_analysis", { redirectTo: "/train" });
  return <>{children}</>;
}
