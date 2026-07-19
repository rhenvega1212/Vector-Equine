"use client";

/**
 * Annotation lane (§6.1): annotation "clips" laid on the same x-axis as the
 * tracks. Range annotations render as blocks; point events (start==end) render
 * as a thin marker. Selecting a clip opens it in the inspector.
 */
import { useAnnotationStore } from "@/lib/annotation/store";
import { getLabelForVersion, type LabelCategory } from "@/lib/annotation/taxonomy";
import { LABEL_GUTTER_PX, useTimeline } from "./timeline-context";
import { cn } from "@/lib/utils";

const CATEGORY_COLOR: Record<LabelCategory, string> = {
  aid: "bg-sky-500/30 border-sky-400/70",
  execution: "bg-emerald-500/30 border-emerald-400/70",
  timing: "bg-violet-500/30 border-violet-400/70",
  gait: "bg-amber-500/30 border-amber-400/70",
  fault: "bg-rose-500/30 border-rose-400/70",
  note: "bg-slate-400/25 border-slate-300/60",
};

export function AnnotationLane() {
  const geom = useTimeline();
  const annotations = useAnnotationStore((s) => s.annotations);
  const selectionId = useAnnotationStore((s) => s.selectionId);
  const select = useAnnotationStore((s) => s.select);

  return (
    <div className="flex items-stretch border-t border-white/10 bg-white/[0.02]">
      <div
        className="flex shrink-0 items-center px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        style={{ width: LABEL_GUTTER_PX }}
      >
        Annotations · {annotations.length}
      </div>
      <div className="relative h-14 flex-1">
        {annotations.map((a) => {
          const def = getLabelForVersion(a.labelVersion, a.labelKey);
          const category = (def?.category ?? "note") as LabelCategory;
          const isPoint = a.endMs <= a.startMs;
          const left = geom.msToPx(a.startMs);
          const width = isPoint
            ? 0
            : Math.max(2, geom.msToPx(a.endMs) - geom.msToPx(a.startMs));
          const selected = a.id === selectionId;
          const inView = a.endMs >= geom.startMs && a.startMs <= geom.endMs;
          if (!inView) return null;

          if (isPoint) {
            return (
              <button
                key={a.id}
                onClick={() => select(a.id)}
                className="absolute top-1 flex flex-col items-center"
                style={{ left }}
                title={def?.label ?? a.labelKey}
              >
                <div
                  className={cn(
                    "h-3 w-3 rotate-45 border",
                    CATEGORY_COLOR[category],
                    selected && "ring-2 ring-gold"
                  )}
                />
              </button>
            );
          }

          return (
            <button
              key={a.id}
              onClick={() => select(a.id)}
              className={cn(
                "absolute top-1 flex h-8 items-center overflow-hidden rounded border px-1 text-left",
                CATEGORY_COLOR[category],
                selected && "ring-2 ring-gold"
              )}
              style={{ left, width }}
              title={def?.label ?? a.labelKey}
            >
              <span className="truncate text-[10px] font-medium text-white/90">
                {def?.label ?? a.labelKey}
              </span>
            </button>
          );
        })}
        {annotations.length === 0 && (
          <div className="flex h-full items-center px-3 text-[11px] text-muted-foreground">
            Drag across a signal track to create your first annotation.
          </div>
        )}
      </div>
    </div>
  );
}
