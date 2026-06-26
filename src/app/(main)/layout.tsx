import { redirect } from "next/navigation";
import { MainLayoutClient } from "@/components/layouts/main-layout-client";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getFlagsForProfile } from "@/lib/flags/server";

// Always fetch fresh profile so role/permission changes from admin panel take effect
export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, isImpersonating } = await getCurrentProfile();

  if (!user) {
    redirect("/login");
  }

  if (!profile?.username) {
    redirect("/onboarding");
  }

  const flags = await getFlagsForProfile(profile);

  // Admins (incl. while impersonating a rider) can moderate content.
  const canModerate = isImpersonating || profile.role === "admin";

  return (
    <MainLayoutClient
      profile={profile}
      isImpersonating={isImpersonating}
      flags={flags}
      canModerate={canModerate}
    >
      {children}
    </MainLayoutClient>
  );
}
