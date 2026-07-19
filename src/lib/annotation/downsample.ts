/**
 * Downsampling for display (§2.5, §2.6, §6.3).
 *
 * Sensors run 100+ Hz — raw samples never go in the DOM, and we never draw more
 * points than there are horizontal pixels. For the visible window we compute a
 * min/max bucket per pixel column so transients survive decimation (a plain
 * stride would drop spikes). Full-resolution data stays in memory/storage for
 * export only.
 */
import type { SignalSeries } from "./types";

export interface Bucket {
  /** representative x (ms) for the column */
  tMs: number;
  min: number;
  max: number;
}

export interface DownsampleResult {
  buckets: Bucket[];
  /** overall min/max across the window, for autoscaling the track */
  yMin: number;
  yMax: number;
}

/**
 * Binary search for the first index with t[i] >= target.
 * Series time arrays are monotonically increasing.
 */
function lowerBound(t: Float64Array, target: number): number {
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (t[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Min/max bucket a series over [startMs, endMs] into `pixelWidth` columns.
 * Only touches the samples inside the window (windowed loading, §6.3).
 */
export function downsampleMinMax(
  series: SignalSeries,
  startMs: number,
  endMs: number,
  pixelWidth: number
): DownsampleResult {
  const width = Math.max(1, Math.floor(pixelWidth));
  const buckets: Bucket[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;

  if (endMs <= startMs || series.t.length === 0) {
    return { buckets, yMin: 0, yMax: 1 };
  }

  const startIdx = lowerBound(series.t, startMs);
  const endIdx = lowerBound(series.t, endMs);
  const spanMs = endMs - startMs;

  // If there are fewer samples than pixels, emit one bucket per sample.
  const sampleCount = endIdx - startIdx;
  if (sampleCount <= width) {
    for (let i = startIdx; i < endIdx; i++) {
      const val = series.v[i];
      buckets.push({ tMs: series.t[i], min: val, max: val });
      if (val < yMin) yMin = val;
      if (val > yMax) yMax = val;
    }
    return finalize(buckets, yMin, yMax);
  }

  const bucketMs = spanMs / width;
  let cursor = startIdx;
  for (let col = 0; col < width; col++) {
    const colEndMs = startMs + (col + 1) * bucketMs;
    let mn = Infinity;
    let mx = -Infinity;
    let count = 0;
    while (cursor < endIdx && series.t[cursor] < colEndMs) {
      const val = series.v[cursor];
      if (val < mn) mn = val;
      if (val > mx) mx = val;
      cursor++;
      count++;
    }
    if (count > 0) {
      buckets.push({ tMs: startMs + (col + 0.5) * bucketMs, min: mn, max: mx });
      if (mn < yMin) yMin = mn;
      if (mx > yMax) yMax = mx;
    }
  }

  return finalize(buckets, yMin, yMax);
}

function finalize(buckets: Bucket[], yMin: number, yMax: number): DownsampleResult {
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    return { buckets, yMin: 0, yMax: 1 };
  }
  if (yMin === yMax) {
    return { buckets, yMin: yMin - 1, yMax: yMax + 1 };
  }
  return { buckets, yMin, yMax };
}
