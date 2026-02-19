import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MainLayoutClient } from "@/components/layouts/main-layout-client";
import { getImpersonateCookieName } from "@/lib/admin/impersonate";

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

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as { data: any };

  if (!myProfile?.username) {
    redirect("/onboarding");
  }

  let profile = myProfile;
  let isImpersonating = false;
  const cookieStore = await cookies();
  const impersonateId = cookieStore.get(getImpersonateCookieName())?.value;
  if (impersonateId && myProfile?.role === "admin" && impersonateId !== user.id) {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", impersonateId)
      .single() as { data: any };
    if (targetProfile?.username) {
      profile = targetProfile;
      isImpersonating = true;
    }
  }

  return (
    <MainLayoutClient profile={profile} isImpersonating={isImpersonating}>
      {children}
    </MainLayoutClient>
  );
}
