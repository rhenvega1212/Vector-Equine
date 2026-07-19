"use client";

/**
 * Timeline (§6.1): the shared axis + playhead that hosts the sensor tracks and
 * the annotation lane. Measures the plot-area width once (ResizeObserver) and
 * hands every child the same ms↔px geometry. Wheel = zoom (anchored at cursor),
 * shift+wheel = pan.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAnnotationStore } from "@/lib/annotation/store";
import {
  createGeometry,
  LABEL_GUTTER_PX,
  TimelineProvider,
} from "./timeline-context";
import { TimeRuler } from "./time-ruler";
import { SensorTrackGroup } from "./sensor-track-group";
import { AnnotationLane } from "./annotation-lane";
import { TimelineOverlay } from "./timeline-overlay";

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  const { sensors, startMs, endMs } = useAnnotationStore(
    useShallow((s) => ({
      sensors: s.session?.sensors ?? [],
      startMs: s.visibleWindow.startMs,
      endMs: s.visibleWindow.endMs,
    }))
  );
  const zoom = useAnnotationStore((s) => s.zoom);
  const pan = useAnnotationStore((s) => s.pan);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContentWidth(w);
    });
    ro.observe(el);
    setContentWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const plotWidth = Math.max(0, contentWidth - LABEL_GUTTER_PX);
  const geom = useMemo(
    () => createGeometry(plotWidth, startMs, endMs),
    [plotWidth, startMs, endMs]
  );

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // vertical wheel → zoom anchored under the cursor
      const rect = e.currentTarget.getBoundingClientRect();
      const xInPlot = e.clientX - rect.left - LABEL_GUTTER_PX;
      if (xInPlot < 0) return;
      const anchorMs = geom.pxToMs(xInPlot);
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      zoom(factor, anchorMs);
    } else {
      pan((e.deltaX / Math.max(1, plotWidth)) * (endMs - startMs));
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg border border-white/10 bg-navy"
      onWheel={onWheel}
    >
      <TimelineProvider value={geom}>
        <TimeRuler />
        <div className="max-h-[52vh] overflow-y-auto">
          {sensors.map((sensor) => (
            <SensorTrackGroup key={sensor.id} sensor={sensor} />
          ))}
        </div>
        <AnnotationLane />
        {/* overlay spans the plot area only (offset past the label gutter) */}
        <div
          className="pointer-events-none absolute inset-y-0"
          style={{ left: LABEL_GUTTER_PX, right: 0 }}
        >
          <TimelineOverlay />
        </div>
      </TimelineProvider>
    </div>
  );
}
