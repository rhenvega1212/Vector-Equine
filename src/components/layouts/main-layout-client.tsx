"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { UserX, Loader2 } from "lucide-react";
import { UploadProgressBar } from "@/components/shared/upload-progress-bar";
import { FeatureFlagsProvider } from "@/lib/flags/context";
import { allFlagsOff, type EvaluatedFlags } from "@/lib/flags/registry";
import { CurrentUserProvider } from "@/lib/auth/current-user-context";

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
  flags = allFlagsOff(),
  canModerate = false,
}: {
  children: React.ReactNode;
  profile: any;
  isImpersonating?: boolean;
  flags?: EvaluatedFlags;
  canModerate?: boolean;
}) {
  const [stopping, setStopping] = useState(false);

  async function handleStopImpersonating() {
    setStopping(true);
    try {
      const res = await fetch("/api/admin/impersonate/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (!res.ok) {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    } finally {
      setStopping(false);
    }
  }

  return (
    <FeatureFlagsProvider flags={flags}>
    <CurrentUserProvider canModerate={canModerate}>
    <div className="min-h-screen bg-background">
      {isImpersonating && (
        <div
          className="fixed right-3 z-[60] flex items-center gap-3 rounded-xl border border-gold/30 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-xl md:right-4"
          style={{ bottom: "calc(96px + env(safe-area-inset-bottom) + 12px)" }}
        >
          <span className="text-xs sm:text-sm text-foreground">
            Viewing as <strong>{profile?.display_name}</strong>{" "}
            <span className="text-muted-foreground">@{profile?.username}</span>
          </span>
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-navy text-cream font-semibold border-transparent shadow-sm hover:bg-navy/90"
            onClick={handleStopImpersonating}
            disabled={stopping}
          >
            {stopping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserX className="h-4 w-4" />
                Exit view
              </>
            )}
          </Button>
        </div>
      )}
      <MainNav profile={profile} />
      <main
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-6"
        style={{
          paddingTop: "calc(3.5rem + env(safe-area-inset-top) + 0.75rem)",
          paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      <MobileNav profile={profile} />
      <UploadProgressBar />
    </div>
    </CurrentUserProvider>
    </FeatureFlagsProvider>
  );
}
