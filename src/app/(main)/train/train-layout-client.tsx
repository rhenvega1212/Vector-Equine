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
    <div className="dark bg-navy text-cream min-h-[70vh] -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 md:pb-6">
      <div className="space-y-5 sm:space-y-6">{children}</div>

      {!hideLoopNav && (
        <nav
          className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none md:bottom-6"
          style={{
            // Sit just above the compact app tab bar (h-12 + safe area)
            bottom: "calc(3rem + env(safe-area-inset-bottom, 0px) + 0.5rem)",
          }}
          aria-label="Vector loop"
        >
          <div className="pointer-events-auto flex items-end gap-0.5 rounded-2xl border border-gold/25 bg-navy/95 px-1.5 py-1.5 shadow-lg shadow-black/40 backdrop-blur-md">
            <LoopLink
              href="/train"
              label="Today"
              icon={CalendarDays}
              active={pathname === "/train"}
            />
            <Link
              href="/train/ride/plan"
              className="mx-0.5 flex h-12 w-12 -translate-y-1.5 flex-col items-center justify-center rounded-full bg-gold text-navy transition hover:bg-gold-bright"
              aria-label="Start ride"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              <span className="text-[8px] font-semibold uppercase tracking-wider">
                Start
              </span>
            </Link>
            <LoopLink
              href="/train/horse"
              label="Horse"
              icon={HorseHeadIcon}
              active={
                pathname.startsWith("/train/horse") ||
                pathname.startsWith("/train/horses")
              }
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
        "flex min-w-[3.75rem] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
        active ? "text-gold" : "text-cream/60 hover:text-cream"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "text-gold")} />
      {label}
    </Link>
  );
}
