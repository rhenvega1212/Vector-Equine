"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";

interface MainNavProps {
  profile: Profile;
}

export function MainNav({ profile }: MainNavProps) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = await res.json();
        const count = (data.notifications ?? []).filter(
          (n: { is_read?: boolean }) => !n.is_read
        ).length;
        if (active) setUnread(count);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pathname]);

  const isActive = pathname.startsWith("/notifications");

  return (
    <header
      className="dark fixed top-0 left-0 right-0 z-50 w-full border-b border-white/10 bg-navy text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container mx-auto flex h-14 sm:h-16 items-center px-3 sm:px-4">
        <Link href="/feed" className="flex items-center">
          <Image
            src="/logo-mark.png"
            alt="Vector Equine"
            width={48}
            height={36}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/notifications" aria-label="Notifications">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full hover:bg-white/10"
            >
              <Bell
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary" : "text-foreground"
                )}
              />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
