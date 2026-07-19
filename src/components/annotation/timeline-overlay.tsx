"use client";

/**
 * Non-interactive overlay layer that draws the playhead and the in-progress
 * draft selection on top of every track. Only this thin layer subscribes to
 * `currentMs`, so the frequent clock ticks don't re-render the canvases.
 */
import { useAnnotationStore } from "@/lib/annotation/store";
import { useTimeline } from "./timeline-context";

export function TimelineOverlay() {
  const geom = useTimeline();
  const currentMs = useAnnotationStore((s) => s.currentMs);
  const draft = useAnnotationStore((s) => s.draft);

  const playheadX = geom.msToPx(currentMs);
  const showPlayhead = currentMs >= geom.startMs && currentMs <= geom.endMs;

  let draftLeft = 0;
  let draftWidth = 0;
  if (draft) {
    const a = Math.min(draft.startMs, draft.endMs);
    const b = Math.max(draft.startMs, draft.endMs);
    draftLeft = geom.msToPx(a);
    draftWidth = Math.max(1, geom.msToPx(b) - geom.msToPx(a));
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {draft && (
        <div
          className="absolute inset-y-0 border-x border-gold/60 bg-gold/10"
          style={{ left: draftLeft, width: draftWidth }}
        />
      )}
      {showPlayhead && (
        <div className="absolute inset-y-0" style={{ left: playheadX }}>
          <div className="h-full w-px bg-red-400/90" />
          <div className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-red-400" />
        </div>
      )}
    </div>
  );
}
