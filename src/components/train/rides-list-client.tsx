"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";
import { useFeatureFlag } from "@/lib/flags/context";
import { groupRidesByDate } from "@/lib/train/group-rides";
import { cn } from "@/lib/utils";

export type RidesListItem = {
  id: string;
  title: string;
  meta: string;
  searchText: string;
  session_date: string;
  /** Future sensor readout — leave empty for now. */
  sensorValue?: string | null;
};

export function RidesListClient({
  horseLabel,
  rides,
}: {
  horseLabel: string;
  rides: RidesListItem[];
}) {
  const router = useRouter();
  const planEnabled = useFeatureFlag("video_analysis");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rides;
    return rides.filter((r) => r.searchText.toLowerCase().includes(q));
  }, [rides, query]);

  const groups = useMemo(() => groupRidesByDate(filtered), [filtered]);

  // Warm the first few rides so tap → detail feels instant
  useEffect(() => {
    for (const r of rides.slice(0, 8)) {
      try {
        router.prefetch(`/train/sessions/${r.id}`);
      } catch {
        /* ignore */
      }
    }
  }, [rides, router]);

  return (
    <AtmosphereScreen className="min-h-[70vh] -mx-3 sm:-mx-4 px-0">
      <div className="px-[26px] pt-4 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 font-[Georgia,'Times_New_Roman',serif] text-[40px] font-normal leading-none text-cream">
              Rides
            </h1>
            <p className="mt-[13px] text-[10px] uppercase tracking-[0.28em] text-cream-dim">
              {horseLabel} · {filtered.length}{" "}
              {filtered.length === 1 ? "RIDE" : "RIDES"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="flex h-12 w-12 shrink-0 items-center justify-center text-[28px] leading-none text-gold transition-colors hover:text-gold-bright"
            aria-label="Search rides"
            aria-expanded={searchOpen}
          >
            ⌕
          </button>
        </div>

        {searchOpen ? (
          <div className="mt-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title"
              autoFocus
              className="h-11 w-full border-0 border-b border-[var(--line)] bg-transparent px-0 text-[15px] text-cream placeholder:text-cream-dim/60 outline-none focus:border-gold"
            />
          </div>
        ) : null}
      </div>

      <div className="h-[38px]" />

      {filtered.length === 0 ? (
        <div className="px-[26px] pb-24">
          <p className="font-[Georgia,'Times_New_Roman',serif] text-lg text-cream">
            {rides.length === 0
              ? "No rides yet."
              : "No rides match that title."}
          </p>
          {rides.length === 0 && planEnabled ? (
            <Link
              href="/train/ride/plan"
              className="mt-4 inline-block text-[12.5px] tracking-[0.04em] text-gold hover:text-gold-bright"
            >
              Plan a ride →
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="px-[26px] pb-24">
          {groups.map((g, gi) => (
            <div key={g.label} className={cn(gi > 0 && "mt-9")}>
              <p className="mb-0.5 text-[10px] uppercase tracking-[0.28em] text-gold">
                {g.label}
              </p>
              {g.rides.map((r) => (
                <div key={r.id}>
                  <hr className="m-0 h-px border-0 bg-[var(--line)]" />
                  <Link
                    href={`/train/sessions/${r.id}`}
                    prefetch
                    onMouseEnter={() => {
                      try {
                        router.prefetch(`/train/sessions/${r.id}`);
                      } catch {
                        /* ignore */
                      }
                    }}
                    onTouchStart={() => {
                      try {
                        router.prefetch(`/train/sessions/${r.id}`);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="flex items-start gap-4 py-5 transition-opacity hover:opacity-[0.66]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[9.5px] uppercase tracking-[0.18em] text-cream-dim">
                        {r.meta}
                      </p>
                      <p className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-[18px] leading-[1.32] text-cream">
                        {r.title}
                      </p>
                    </div>
                    <span
                      className="w-10 shrink-0 pt-0.5 text-right font-[Georgia,'Times_New_Roman',serif] text-[18px] text-gold"
                      aria-hidden={!r.sensorValue}
                    >
                      {r.sensorValue || ""}
                    </span>
                  </Link>
                </div>
              ))}
              <hr className="m-0 h-px border-0 bg-[var(--line)]" />
            </div>
          ))}
        </div>
      )}
    </AtmosphereScreen>
  );
}
