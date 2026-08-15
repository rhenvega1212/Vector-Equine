"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/train", label: "Ride", match: (p: string) => p === "/train" },
  {
    href: "/train/sessions?range=all",
    label: "Rides",
    match: (p: string) =>
      p === "/train/sessions" ||
      p.startsWith("/train/sessions?") ||
      (p.startsWith("/train/sessions/") && !p.startsWith("/train/sessions/new")),
  },
  {
    href: "/train/horse",
    label: "Horse",
    match: (p: string) =>
      p.startsWith("/train/horse") || p.startsWith("/train/horses"),
  },
  {
    href: "/settings",
    label: "More",
    match: (p: string) =>
      p.startsWith("/settings") || p.startsWith("/profile"),
  },
] as const;

const NAV_GLYPHS = ["◇", "▤", "⌾", "☰"] as const;

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
    /\/train\/(sessions|horses)\/[^/]+\/edit/.test(pathname) ||
    /\/train\/sessions\/[^/]+\/ask$/.test(pathname);

  const isHome = pathname === "/train";
  const isRidesSurface =
    isHome ||
    pathname === "/train/sessions" ||
    pathname.startsWith("/train/sessions?") ||
    (/^\/train\/sessions\/[^/]+$/.test(pathname) &&
      !pathname.includes("/edit") &&
      !pathname.includes("/new"));

  return (
    <div
      className={cn(
        "dark text-cream min-h-[70vh]",
        isRidesSurface
          ? "bg-transparent -mx-3 sm:-mx-4 px-0 pt-0 pb-0"
          : "bg-navy -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 md:pb-6"
      )}
    >
      <div className={cn(!isRidesSurface && "space-y-5 sm:space-y-6")}>{children}</div>

      {!hideLoopNav && (
        <nav
          className="fixed left-0 right-0 z-40 border-t border-[var(--line)] bg-[rgba(10,17,34,0.95)] backdrop-blur-[10px]"
          style={{
            bottom: 0,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          aria-label="Vector"
        >
          <div className="flex h-[62px] items-center justify-around px-2">
            {NAV_ITEMS.map((item, i) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 min-w-[4.5rem] flex-col items-center justify-center gap-1.5 px-2",
                    active ? "text-gold" : "text-cream-dim"
                  )}
                >
                  <span
                    className="font-[Georgia,'Times_New_Roman',serif] text-[15px] leading-none"
                    aria-hidden
                  >
                    {NAV_GLYPHS[i]}
                  </span>
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.2em]">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
