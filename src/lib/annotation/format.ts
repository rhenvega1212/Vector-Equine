/** Time + placement formatting helpers for the annotation UI. */
import type { Placement } from "./types";

/** ms → `m:ss.mmm` (or `m:ss` when compact). */
export function formatMs(ms: number, compact = false): string {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const millis = Math.floor(clamped % 1000);
  const base = `${min}:${sec.toString().padStart(2, "0")}`;
  return compact ? base : `${base}.${millis.toString().padStart(3, "0")}`;
}

/** Short duration label for a span. */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const PLACEMENT_LABELS: Record<Placement, string> = {
  head: "Head",
  torso: "Torso",
  pelvis: "Pelvis",
  left_wrist: "L. wrist",
  right_wrist: "R. wrist",
  left_upper_arm: "L. upper arm",
  right_upper_arm: "R. upper arm",
  left_thigh: "L. thigh",
  right_thigh: "R. thigh",
  left_calf: "L. calf",
  right_calf: "R. calf",
  left_foot: "L. foot",
  right_foot: "R. foot",
  horse_poll: "Horse poll",
  horse_withers: "Horse withers",
  horse_croup: "Horse croup",
  other: "Other",
};

export function formatPlacement(p: Placement): string {
  return PLACEMENT_LABELS[p] ?? p;
}
