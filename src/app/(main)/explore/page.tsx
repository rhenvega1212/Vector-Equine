import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ExploreClient } from "@/components/explore/explore-client";
import { getImpersonateCookieName } from "@/lib/admin/impersonate";

export default async function ExplorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single() as { data: { role?: string } | null };

  const cookieStore = await cookies();
  const impersonateId = cookieStore.get(getImpersonateCookieName())?.value;
  const effectiveUserId =
    user && profile?.role === "admin" && impersonateId
      ? impersonateId
      : user?.id ?? "";

  return <ExploreClient userId={effectiveUserId} />;
}
