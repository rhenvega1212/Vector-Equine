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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t glass md:hidden safe-area-bottom">
      <div
        className="flex items-center justify-around"
        style={{
          height: "calc(60px + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
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
                  "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[10px] touch-target cursor-not-allowed opacity-70 text-muted-foreground"
                )}
                title="Coming soon"
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[10px] transition-all duration-300 touch-target",
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground active:text-foreground active:scale-95"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn("font-medium", isActive && "text-primary")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
