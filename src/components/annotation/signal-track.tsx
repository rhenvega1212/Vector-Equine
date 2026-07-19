"use client";

/**
 * A single signal rendered as a canvas waveform (§6.3: canvas only, never
 * per-sample DOM). Data is min/max downsampled to the plot width for the
 * visible window; full-resolution stays in the store for export.
 *
 * Pointer interactions:
 *   - click (no drag)  → seek the master clock to that time
 *   - horizontal drag  → create a draft annotation targeting this signal
 */
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAnnotationStore } from "@/lib/annotation/store";
import { downsampleMinMax } from "@/lib/annotation/downsample";
import type { Signal } from "@/lib/annotation/types";
import { useTimeline } from "./timeline-context";
import { cn } from "@/lib/utils";

const DRAG_THRESHOLD_PX = 4;

export function SignalTrack({
  signal,
  height = 44,
  summary = false,
}: {
  signal: Signal;
  height?: number;
  summary?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geom = useTimeline();
  const series = useAnnotationStore((s) => s.series.get(`${signal.sensorId}:${signal.key}`));
  const { requestSeek, beginDraft, updateDraft, pxToMs } = useAnnotationStore(
    useShallow((s) => ({
      requestSeek: s.requestSeek,
      beginDraft: s.beginDraft,
      updateDraft: s.updateDraft,
      pxToMs: (px: number) => geom.pxToMs(px),
    }))
  );

  const color = summary
    ? "rgba(203, 163, 92, 0.9)"
    : signal.kind === "derived"
      ? "rgba(203, 163, 92, 0.85)"
      : "rgba(120, 170, 220, 0.85)";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || geom.widthPx <= 0 || !series) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const w = geom.widthPx;
    const h = height;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { buckets, yMin, yMax } = downsampleMinMax(
      series,
      geom.startMs,
      geom.endMs,
      w
    );
    const range = yMax - yMin || 1;
    const yToPx = (v: number) => h - ((v - yMin) / range) * (h - 6) - 3;

    // zero/mean baseline
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // min/max waveform as vertical strokes so transients survive
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const b of buckets) {
      const x = Math.round(geom.msToPx(b.tMs)) + 0.5;
      ctx.moveTo(x, yToPx(b.max));
      ctx.lineTo(x, yToPx(b.min) + 0.6);
    }
    ctx.stroke();
  }, [series, geom, height, color]);

  const dragState = useRef<{ startX: number; started: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = { startX: e.clientX - rect.left, started: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const ds = dragState.current;
    if (!ds) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (!ds.started && Math.abs(x - ds.startX) > DRAG_THRESHOLD_PX) {
      ds.started = true;
      beginDraft(pxToMs(ds.startX), [signal.id]);
    }
    if (ds.started) {
      updateDraft({ endMs: pxToMs(x) });
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const ds = dragState.current;
    dragState.current = null;
    if (!ds) return;
    if (!ds.started) {
      const rect = e.currentTarget.getBoundingClientRect();
      requestSeek(pxToMs(e.clientX - rect.left));
    }
  }

  return (
    <div
      className={cn(
        "relative touch-none select-none",
        summary ? "cursor-pointer" : "cursor-crosshair"
      )}
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <canvas ref={canvasRef} className="block" />
      {!series && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
          no data
        </div>
      )}
    </div>
  );
}
