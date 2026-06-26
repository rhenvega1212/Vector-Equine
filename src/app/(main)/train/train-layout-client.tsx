"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ClipboardList, BarChart3, Bot } from "lucide-react";
import { HorseHeadIcon } from "@/components/icons/horse-head";

const trainNavItems = [
  { href: "/train", label: "Dashboard", icon: LayoutDashboard },
  { href: "/train/horses", label: "Horses", icon: HorseHeadIcon },
  { href: "/train/sessions", label: "Sessions", icon: ClipboardList },
  { href: "/train/insights", label: "Insights", icon: BarChart3 },
  { href: "/train/ai-trainer", label: "AI Trainer", icon: Bot },
];

export function TrainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-navy min-h-screen -mx-3 sm:-mx-4 px-3 sm:px-4 py-6">
      <div className="bg-background text-foreground rounded-xl border border-border shadow-sm p-4 sm:p-6">
        <div className="space-y-6">
          <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
            {trainNavItems.map((item) => (
              <TrainNavLink key={item.href} href={item.href} icon={item.icon}>
                {item.label}
              </TrainNavLink>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}

function TrainNavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/train"
      ? pathname === "/train" || pathname === "/train/dashboard"
      : pathname.startsWith(href);

  return (
    <Link
      href={href === "/train" ? "/train" : href}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-gold text-navy border border-gold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
