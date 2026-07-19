"use client";

/**
 * Shared timeline geometry. Every track, the ruler, the playhead and the
 * annotation lane read the *same* ms↔px mapping from here so they stay locked
 * to one axis (the visual counterpart of the one-master-clock rule).
 */
import { createContext, useContext } from "react";

export interface TimelineGeometry {
  /** measured pixel width of the track/plot area (excludes the label gutter) */
  widthPx: number;
  startMs: number;
  endMs: number;
  msToPx: (ms: number) => number;
  pxToMs: (px: number) => number;
}

const TimelineContext = createContext<TimelineGeometry | null>(null);

export function TimelineProvider({
  value,
  children,
}: {
  value: TimelineGeometry;
  children: React.ReactNode;
}) {
  return (
    <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>
  );
}

export function useTimeline(): TimelineGeometry {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("useTimeline must be used within TimelineProvider");
  return ctx;
}

export function createGeometry(
  widthPx: number,
  startMs: number,
  endMs: number
): TimelineGeometry {
  const span = Math.max(1, endMs - startMs);
  return {
    widthPx,
    startMs,
    endMs,
    msToPx: (ms) => ((ms - startMs) / span) * widthPx,
    pxToMs: (px) => startMs + (px / Math.max(1, widthPx)) * span,
  };
}

/** Width of the fixed left label gutter, shared by all timeline rows. */
export const LABEL_GUTTER_PX = 176;
