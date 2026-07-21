"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, User } from "lucide-react";
import { HorseHeadIcon } from "@/components/icons/horse-head";
import type { Profile } from "@/types/database";
import { useFeatureFlags } from "@/lib/flags/context";
import type { FeatureFlagKey } from "@/lib/flags/registry";
import type { ComponentType } from "react";
import { SOCIAL_CONFIG } from "@/lib/social/config";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  flag?: FeatureFlagKey;
  community?: boolean;
};

const navItems: NavItem[] = [
  { href: "/train", label: "Vector", icon: HorseHeadIcon, flag: "training_diary" },
  { href: "/feed", label: "Community", icon: Users, community: true },
  { href: "/profile", label: "Profile", icon: User },
];

interface MobileNavProps {
  profile: Profile;
}

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname();
  const flags = useFeatureFlags();

  const onVector = pathname.startsWith("/train");

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t md:hidden",
        onVector
          ? "border-gold/15 bg-navy/95 text-cream backdrop-blur-md"
          : "glass border-border"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-12 items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const flagBlocked = !!item.flag && !flags[item.flag];
          const adminBlocked = !!item.adminOnly && profile.role !== "admin";
          const communityBlocked =
            !!item.community && SOCIAL_CONFIG.SOCIAL_MODE === "off";
          const showAsDisabled = flagBlocked || adminBlocked || communityBlocked;
          const isActive = !showAsDisabled && pathname.startsWith(item.href);

          if (showAsDisabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  "flex h-11 w-16 flex-col items-center justify-center gap-0.5 text-[10px] cursor-not-allowed opacity-50",
                  onVector ? "text-cream/40" : "text-muted-foreground"
                )}
                title="Coming soon"
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium leading-none">{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-11 w-16 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors",
                isActive
                  ? onVector
                    ? "text-gold"
                    : "text-primary"
                  : onVector
                    ? "text-cream/55 active:text-cream"
                    : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && (onVector ? "text-gold" : "text-primary"))} />
              <span className="font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
