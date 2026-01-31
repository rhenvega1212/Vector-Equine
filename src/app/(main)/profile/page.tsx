import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileRedirectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's profile to get their username
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single() as { data: { username: string } | null };

  if (!profile?.username) {
    redirect("/onboarding");
  }

  // Redirect to the user's profile page
  redirect(`/profile/${profile.username}`);
}
