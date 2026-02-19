"use client";

import dynamic from "next/dynamic";

// Load nav only on client to avoid PathnameContext/useContext null during SSR (Next.js 14.2.x)
const MainNav = dynamic(
  () => import("@/components/shared/main-nav").then((m) => ({ default: m.MainNav })),
  { ssr: false }
);
const MobileNav = dynamic(
  () => import("@/components/shared/mobile-nav").then((m) => ({ default: m.MobileNav })),
  { ssr: false }
);

export function MainLayoutClient({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: any;
}) {
  // No loading screen – show app immediately so login → app flow is clear
  return (
    <div className="min-h-screen bg-background">
      <MainNav profile={profile} />
      <main
        className="container mx-auto px-4 py-4 sm:py-6 md:pb-6"
        style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
      <MobileNav profile={profile} />
    </div>
  );
}
