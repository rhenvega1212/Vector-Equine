"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { UserX } from "lucide-react";

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
  isImpersonating = false,
}: {
  children: React.ReactNode;
  profile: any;
  isImpersonating?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      {isImpersonating && (
        <div className="sticky top-0 z-[60] flex items-center justify-between gap-2 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-sm text-amber-200">
          <span>
            Viewing as <strong>{profile?.display_name}</strong> (@{profile?.username})
          </span>
          <form action="/api/admin/impersonate/stop" method="POST">
            <Button type="submit" variant="outline" size="sm" className="gap-1 border-amber-500/50 text-amber-200 hover:bg-amber-500/20">
              <UserX className="h-4 w-4" />
              Stop impersonating
            </Button>
          </form>
        </div>
      )}
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
