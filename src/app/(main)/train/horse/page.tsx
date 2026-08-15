import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Collapse dual horse surfaces — horse room lives at /train/horses/[id]. */
export default async function HorseRoomRedirect({
  searchParams,
}: {
  searchParams: Promise<{ horseId?: string }>;
}) {
  const { horseId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (horseId) {
    redirect(`/train/horses/${horseId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_horse_id")
    .eq("id", user.id)
    .maybeSingle();

  const activeId = profile?.active_horse_id;

  if (activeId) {
    redirect(`/train/horses/${activeId}`);
  }

  const { data: first } = await supabase
    .from("horse_profiles")
    .select("id")
    .eq("user_id", user.id)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (first?.id) {
    redirect(`/train/horses/${first.id}`);
  }

  redirect("/train/horses");
}
