"use client";

/** Shared time axis (§6.1). Renders nice tick marks and seeks on click. */
import { useAnnotationStore } from "@/lib/annotation/store";
import { formatMs } from "@/lib/annotation/format";
import { LABEL_GUTTER_PX, useTimeline } from "./timeline-context";

/** Choose a human-friendly tick interval (ms) for the visible span. */
function niceInterval(spanMs: number, targetTicks: number): number {
  const rough = spanMs / targetTicks;
  const candidates = [
    50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000,
    120000, 300000,
  ];
  for (const c of candidates) if (c >= rough) return c;
  return candidates[candidates.length - 1];
}

export function TimeRuler() {
  const geom = useTimeline();
  const requestSeek = useAnnotationStore((s) => s.requestSeek);

  const span = geom.endMs - geom.startMs;
  const interval = niceInterval(span, 8);
  const first = Math.ceil(geom.startMs / interval) * interval;
  const ticks: number[] = [];
  for (let t = first; t <= geom.endMs; t += interval) ticks.push(t);

  return (
    <div className="flex items-stretch border-b border-white/10 bg-white/[0.02]">
      <div
        className="shrink-0 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        style={{ width: LABEL_GUTTER_PX }}
      >
        Timeline
      </div>
      <div
        className="relative h-7 flex-1 cursor-pointer"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          requestSeek(geom.pxToMs(e.clientX - rect.left));
        }}
      >
        {ticks.map((t) => {
          const x = geom.msToPx(t);
          return (
            <div
              key={t}
              className="absolute top-0 h-full"
              style={{ left: x }}
            >
              <div className="h-2 w-px bg-white/20" />
              <div className="mt-0.5 -translate-x-1/2 text-[9px] tabular-nums text-muted-foreground">
                {formatMs(t, span > 20000)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
