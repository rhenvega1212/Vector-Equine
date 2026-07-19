"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  Users,
  Trophy,
  User,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { HorseHeadIcon } from "@/components/icons/horse-head";
import { Badge } from "@/components/ui/badge";
import { useFeatureFlags } from "@/lib/flags/context";
import type { FeatureFlagKey } from "@/lib/flags/registry";
import type { ComponentType } from "react";
import { SOCIAL_CONFIG } from "@/lib/social/config";

interface MainNavProps {
  profile: Profile;
}

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  comingSoon?: boolean;
  adminOnly?: boolean;
  flag?: FeatureFlagKey;
  community?: boolean;
};

const navItems: NavItem[] = [
  { href: "/train", label: "Vector", icon: HorseHeadIcon, flag: "training_diary" },
  { href: "/feed", label: "Community", icon: Users, community: true },
  { href: "/challenges", label: "Challenges", icon: Trophy, comingSoon: true, adminOnly: true },
];

export function MainNav({ profile }: MainNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const flags = useFeatureFlags();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = profile.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header
      className="dark fixed top-0 left-0 right-0 z-50 w-full border-b border-white/10 bg-navy text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container mx-auto flex h-14 sm:h-16 items-center px-3 sm:px-4">
        <Link href="/train" className="mr-4 sm:mr-6 flex items-center">
          <Image src="/logo-mark.png" alt="Vector Equine" width={48} height={36}
                 priority className="h-8 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center space-x-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const requiresAdmin = !!item.adminOnly;
            const flagBlocked = !!item.flag && !flags[item.flag];
            const adminBlocked = requiresAdmin && profile.role !== "admin";
            const communityBlocked =
              !!item.community && SOCIAL_CONFIG.SOCIAL_MODE === "off";
            const showAsDisabled = adminBlocked || flagBlocked || communityBlocked;

            if (showAsDisabled) {
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="gap-2 cursor-not-allowed opacity-70"
                  disabled
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="uppercase tracking-[0.18em] text-[11px] font-semibold">{item.label}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    Coming soon
                  </Badge>
                </Button>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "gap-2",
                    isActive && "bg-secondary"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="uppercase tracking-[0.18em] text-[11px] font-semibold">{item.label}</span>
                  {item.comingSoon && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                      Coming soon
                    </Badge>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
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
      </div>
    </header>
  );
}
