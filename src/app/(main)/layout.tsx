import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MainLayoutClient } from "@/components/layouts/main-layout-client";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as { data: any };

  if (!profile?.username) {
    redirect("/onboarding");
  }

  return (
    <MainLayoutClient profile={profile}>
      {children}
    </MainLayoutClient>
  );
}
