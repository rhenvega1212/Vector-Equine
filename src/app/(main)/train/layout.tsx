import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrainLayoutClient } from "./train-layout-client";

export default async function TrainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/feed");
  }

  return <TrainLayoutClient>{children}</TrainLayoutClient>;
}
