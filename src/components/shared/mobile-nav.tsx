"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Trophy, Compass, User, Settings, LogOut, Shield } from "lucide-react";
import { HorseHeadIcon } from "@/components/icons/horse-head";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { useFeatureFlags } from "@/lib/flags/context";
import type { FeatureFlagKey } from "@/lib/flags/registry";
import type { ComponentType } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  flag?: FeatureFlagKey;
};

const navItems: NavItem[] = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/train", label: "Train", icon: HorseHeadIcon, flag: "training_diary" },
  { href: "/challenges", label: "Challenges", icon: Trophy, adminOnly: true },
];

interface MobileNavProps {
  profile: Profile;
}

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const flags = useFeatureFlags();

  const initials = profile.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Profile — floating bottom-right */}
      <div
        className="fixed bottom-4 right-3 z-50 sm:right-4"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-full glass shadow-lg transition-transform active:scale-95"
              aria-label="Account menu"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="mb-2 w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {profile.display_name}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/profile/${profile.username}`} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            {profile.role === "admin" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Primary nav — floating bubble, bottom-center */}
      <nav
        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-0.5 rounded-full glass px-2 py-1.5 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const flagBlocked = !!item.flag && !flags[item.flag];
            const adminBlocked = !!item.adminOnly && profile.role !== "admin";
            const showAsDisabled = flagBlocked || adminBlocked;
            const isActive = !showAsDisabled && pathname.startsWith(item.href);

            if (showAsDisabled) {
              return (
                <div
                  key={item.href}
                  className="flex cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] text-muted-foreground opacity-60"
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
                  "flex flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] transition-all duration-200",
                  isActive
                    ? "bg-gold/15 text-primary"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
