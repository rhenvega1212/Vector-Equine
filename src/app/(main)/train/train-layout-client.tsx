"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus } from "lucide-react";
import { HorseHeadIcon } from "@/components/icons/horse-head";

export function TrainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideLoopNav =
    pathname.startsWith("/train/setup") ||
    pathname.startsWith("/train/lab") ||
    pathname.startsWith("/train/ride/") ||
    pathname.startsWith("/train/sessions/new") ||
    pathname.startsWith("/train/horses/new") ||
    /\/train\/(sessions|horses)\/[^/]+\/edit/.test(pathname);

  return (
    <div className="dark bg-navy text-cream min-h-screen -mx-3 sm:-mx-4 px-3 sm:px-4 py-6 pb-28 md:pb-6">
      <div className="space-y-6">{children}</div>

      {!hideLoopNav && (
        <nav
          className="fixed bottom-16 md:bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none"
          aria-label="Vector loop"
        >
          <div className="pointer-events-auto flex items-end gap-1 rounded-2xl border border-gold/20 bg-navy px-2 py-2">
            <LoopLink
              href="/train"
              label="Today"
              icon={CalendarDays}
              active={pathname === "/train"}
            />
            <Link
              href="/train/ride/plan"
              className="mx-1 flex h-14 w-14 -translate-y-2 flex-col items-center justify-center rounded-full bg-gold text-navy transition hover:bg-gold-bright"
              aria-label="Start ride"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Start</span>
            </Link>
            <LoopLink
              href="/train/horse"
              label="Horse"
              icon={HorseHeadIcon}
              active={pathname.startsWith("/train/horse") || pathname.startsWith("/train/horses")}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function LoopLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
        active ? "text-gold" : "text-cream/60 hover:text-cream"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "text-gold")} />
      {label}
    </Link>
  );
}
