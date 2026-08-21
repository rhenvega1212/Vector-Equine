"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserX, Loader2 } from "lucide-react";
import { UploadProgressBar } from "@/components/shared/upload-progress-bar";
import { FeelPendingRedirect } from "@/components/train/feel-rating-sheet";
import { FeatureFlagsProvider } from "@/lib/flags/context";
import { allFlagsOff, type EvaluatedFlags } from "@/lib/flags/registry";
import { CurrentUserProvider } from "@/lib/auth/current-user-context";
import { MainNav } from "@/components/shared/main-nav";
import { MobileNav } from "@/components/shared/mobile-nav";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();
  const onVector = pathname.startsWith("/train");
  const onVectorHome = pathname === "/train";
  const onRidesList =
    pathname === "/train/sessions" || pathname.startsWith("/train/sessions?");
  const onRideDetail =
    /^\/train\/sessions\/[^/]+$/.test(pathname) &&
    !pathname.includes("/edit") &&
    !pathname.includes("/new");
  const onAskRoom = /\/train\/sessions\/[^/]+\/ask$/.test(pathname);
  const onCaptureLive = pathname.startsWith("/train/ride/live");
  const selfPadsBottom =
    onVectorHome || onRidesList || onRideDetail || onAskRoom;

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
    <div
      className={cn(
        "min-h-screen",
        onVector ? "bg-navy text-cream" : "bg-background"
      )}
    >
      {isImpersonating && (
        <div
          className="fixed right-3 z-[60] flex items-center gap-3 rounded-xl border border-gold/30 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-xl md:right-4"
          style={{
            bottom: "calc(3rem + env(safe-area-inset-bottom, 0px) + 12px)",
          }}
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
        className={cn(
          "container mx-auto px-3 sm:px-4",
          // Clear fixed MainNav (h-14 / sm:h-16 + safe-area inset)
          "pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:pt-[calc(4rem+env(safe-area-inset-top,0px))]",
          onCaptureLive
            ? "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
            : selfPadsBottom
              ? "pb-0"
              : onVector
                ? "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
                : "pb-[calc(3rem+env(safe-area-inset-bottom,0px))] md:pb-6"
        )}
      >
        {children}
      </main>
      {/* Vector has its own RIDE · RIDES · HORSE · MORE nav */}
      {!onVector && <MobileNav profile={profile} />}
      <UploadProgressBar />
      <FeelPendingRedirect />
    </div>
    </CurrentUserProvider>
    </FeatureFlagsProvider>
  );
}
