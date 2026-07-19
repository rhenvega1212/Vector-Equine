import { describe, it, expect } from "vitest";
import { downsampleMinMax } from "@/lib/annotation/downsample";
import { magnitude, derivative } from "@/lib/annotation/derived";
import type { SignalSeries } from "@/lib/annotation/types";
import { assembleSession } from "@/lib/annotation/demo";
import { TrivialSyncProvider } from "@/lib/annotation/sync/provider";
import {
  buildExportBundle,
  extractTrainingWindow,
  signalsToCsv,
} from "@/lib/annotation/export/bundle";
import type { Annotation } from "@/lib/annotation/types";

function makeSeries(values: number[], hz = 100): SignalSeries {
  const t = new Float64Array(values.length);
  const v = new Float64Array(values.length);
  const dt = 1000 / hz;
  for (let i = 0; i < values.length; i++) {
    t[i] = i * dt;
    v[i] = values[i];
  }
  return { sensorId: "s", signalKey: "k", sampleRateHz: hz, t, v };
}

describe("downsampleMinMax", () => {
  it("preserves transient spikes via min/max buckets", () => {
    // 1000 samples, a single spike at index 500
    const vals = new Array(1000).fill(0);
    vals[500] = 100;
    const series = makeSeries(vals);
    const res = downsampleMinMax(series, 0, 10_000, 50);
    // the spike must survive decimation into 50 columns
    expect(res.yMax).toBe(100);
    expect(res.buckets.length).toBeLessThanOrEqual(50);
  });

  it("emits one bucket per sample when zoomed past sample density", () => {
    const series = makeSeries([1, 2, 3, 4, 5]);
    const res = downsampleMinMax(series, 0, 50, 800);
    expect(res.buckets.length).toBe(5);
    expect(res.yMin).toBe(1);
    expect(res.yMax).toBe(5);
  });

  it("only reads samples inside the window", () => {
    const series = makeSeries(new Array(1000).fill(0).map((_, i) => i));
    const res = downsampleMinMax(series, 5000, 6000, 100);
    // window [5000,6000)ms at 100hz -> ~indices 500..599 -> values 500..599
    expect(res.yMin).toBeGreaterThanOrEqual(500);
    expect(res.yMax).toBeLessThanOrEqual(600);
  });
});

describe("derived signals", () => {
  it("magnitude computes euclidean norm across components", () => {
    const x = makeSeries([3, 0]);
    const y = makeSeries([4, 0]);
    const z = makeSeries([0, 0]);
    const mag = magnitude([x, y, z]);
    expect(mag[0]).toBeCloseTo(5);
    expect(mag[1]).toBeCloseTo(0);
  });

  it("derivative is per-second and deterministic", () => {
    const s = makeSeries([0, 1, 2, 3], 1000); // 1ms spacing
    const d = derivative(s.t, s.v);
    // slope 1 unit per 1ms = 1000 units/sec
    expect(d[1]).toBeCloseTo(1000);
    expect(d[2]).toBeCloseTo(1000);
  });
});

describe("export round-trip (Phase 4)", () => {
  it("a training window matches the aligned sensor slice", () => {
    const { session, series } = assembleSession({
      id: "test-session",
      title: "t",
      durationMs: 10_000,
      sampleRateHz: 100,
      injectOffsets: true,
    });
    const sync = new TrivialSyncProvider(session);

    const sensor = session.sensors[0];
    const targetSignal = sensor.signals.find((s) => s.key === "accel_x")!;
    const offset = sync.getSensorOffsetMs(sensor.id);

    const annotation: Annotation = {
      id: "a1",
      sessionId: session.id,
      authorId: "tester",
      startMs: 2000,
      endMs: 3000,
      labelKey: "note.marker",
      labelVersion: "v1",
      freeText: null,
      confidence: null,
      source: "human",
      modelVersion: null,
      targetSignalIds: [targetSignal.id],
      createdAt: "now",
      updatedAt: "now",
    };

    const bundle = buildExportBundle(session, series, [annotation], sync);
    const exported = bundle.annotations[0];
    const window = extractTrainingWindow(bundle, exported);

    // every row is the target signal, aligned on the master clock
    expect(window.every((r) => r.signal_id === targetSignal.id)).toBe(true);
    expect(window.every((r) => r.t_ms >= 2000 && r.t_ms <= 3000)).toBe(true);

    // ~1s window at 100hz ≈ 100 rows (±2 for boundary + offset alignment)
    expect(window.length).toBeGreaterThan(90);
    expect(window.length).toBeLessThan(110);

    // rows correspond to raw samples shifted by the sensor offset
    const first = window[0];
    expect(first.t_ms - offset).toBeGreaterThanOrEqual(2000 - offset - 20);

    // bundle includes derived signals too (raw + derived exported)
    expect(bundle.meta.signals.some((s) => s.kind === "derived")).toBe(true);
    // csv serializes with a header
    expect(signalsToCsv(bundle.signals).startsWith("session_id,")).toBe(true);
  });
});
