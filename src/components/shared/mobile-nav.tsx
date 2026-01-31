"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Calendar, Trophy, User } from "lucide-react";

const navItems = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t glass md:hidden safe-area-bottom">
      <div 
        className="flex items-center justify-around"
        style={{ 
          height: 'calc(68px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 text-xs transition-all duration-300 touch-target",
                isActive
                  ? "text-primary scale-110 drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                  : "text-muted-foreground active:text-foreground active:scale-95"
              )}
            >
              <Icon className={cn("h-6 w-6", isActive && "animate-pulse")} />
              <span className={cn("font-medium", isActive && "magical-text")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
