/**
 * Derived-signal layer (§4).
 *
 * Nobody annotates against raw `accel_x` — humans think "the hand jerked".
 * This module computes interpretable signals (movement magnitude, angular
 * velocity magnitude, jerk) for *display and annotation*, while raw signals
 * stay underneath for training.
 *
 * Everything here is a pure, deterministic transform from raw series. Derived
 * signals are ordinary `Signal` rows with `kind='derived'` and a `derivedFrom`
 * recipe, so export includes both raw and derived (§4).
 */
import type { Sensor, Signal, SignalSeries, DerivedRecipe } from "../types";
import { seriesKey } from "../mock/generate";

/** Vector magnitude across parallel series (must share timebase). */
export function magnitude(components: SignalSeries[]): Float64Array {
  if (components.length === 0) return new Float64Array(0);
  const n = components[0].v.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const c of components) {
      const x = c.v[i] ?? 0;
      sum += x * x;
    }
    out[i] = Math.sqrt(sum);
  }
  return out;
}

/** First derivative wrt time (per second). t is in ms. */
export function derivative(t: Float64Array, v: Float64Array): Float64Array {
  const n = v.length;
  const out = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dtMs = t[i] - t[i - 1];
    out[i] = dtMs > 0 ? ((v[i] - v[i - 1]) / dtMs) * 1000 : 0;
  }
  if (n > 1) out[0] = out[1];
  return out;
}

interface DerivedDef {
  key: string;
  label: string;
  unit: string;
  displayGroup: string;
  recipe: DerivedRecipe;
  compute: (raw: Map<string, SignalSeries>, sensor: Sensor) => Float64Array | null;
}

function get(
  raw: Map<string, SignalSeries>,
  sensorId: string,
  key: string
): SignalSeries | undefined {
  return raw.get(seriesKey(sensorId, key));
}

/** The v1 derived catalog. Extend by adding entries. */
const DERIVED_DEFS: DerivedDef[] = [
  {
    key: "movement_magnitude",
    label: "Movement magnitude",
    unit: "m/s²",
    displayGroup: "derived",
    recipe: { op: "magnitude", of: ["accel_x", "accel_y", "accel_z"] },
    compute: (raw, sensor) => {
      const c = ["accel_x", "accel_y", "accel_z"]
        .map((k) => get(raw, sensor.id, k))
        .filter((s): s is SignalSeries => !!s);
      return c.length === 3 ? magnitude(c) : null;
    },
  },
  {
    key: "angular_velocity_magnitude",
    label: "Angular velocity",
    unit: "°/s",
    displayGroup: "derived",
    recipe: { op: "angular_velocity_magnitude", of: ["gyro_x", "gyro_y", "gyro_z"] },
    compute: (raw, sensor) => {
      const c = ["gyro_x", "gyro_y", "gyro_z"]
        .map((k) => get(raw, sensor.id, k))
        .filter((s): s is SignalSeries => !!s);
      return c.length === 3 ? magnitude(c) : null;
    },
  },
  {
    key: "jerk",
    label: "Jerk",
    unit: "m/s³",
    displayGroup: "derived",
    recipe: { op: "jerk", of: ["movement_magnitude"] },
    compute: (raw, sensor) => {
      const mag = get(raw, sensor.id, "movement_magnitude");
      if (!mag) return null;
      return derivative(mag.t, mag.v);
    },
  },
];

/**
 * Given a sensor's raw series, return derived Signal metadata plus their
 * series, mutating a copy is avoided — the derived series are added to the
 * provided map so later recipes (e.g. jerk from movement_magnitude) can chain.
 */
export function computeDerivedForSensor(
  sensor: Sensor,
  series: Map<string, SignalSeries>
): Signal[] {
  const derivedSignals: Signal[] = [];
  for (const def of DERIVED_DEFS) {
    const values = def.compute(series, sensor);
    if (!values) continue;
    // reuse a raw series' timebase for alignment
    const anyRaw = sensor.signals.find((s) => s.kind === "raw");
    const tRef = anyRaw ? series.get(seriesKey(sensor.id, anyRaw.key)) : undefined;
    if (!tRef) continue;

    const signalId = `${sensor.id}__${def.key}`;
    const signal: Signal = {
      id: signalId,
      sensorId: sensor.id,
      key: def.key,
      label: def.label,
      unit: def.unit,
      kind: "derived",
      derivedFrom: def.recipe,
      displayGroup: def.displayGroup,
    };
    derivedSignals.push(signal);
    series.set(seriesKey(sensor.id, def.key), {
      sensorId: sensor.id,
      signalKey: def.key,
      sampleRateHz: sensor.sampleRateHz,
      t: tRef.t,
      v: values,
    });
  }
  return derivedSignals;
}

/**
 * Enrich an entire session's series with derived signals and return the
 * derived Signal metadata per sensor id. Mutates `series` in place (adds
 * derived entries) and returns the derived signal defs so callers can attach
 * them to the sensor.signals arrays.
 */
export function computeDerivedForSession(
  sensors: Sensor[],
  series: Map<string, SignalSeries>
): Map<string, Signal[]> {
  const bySensor = new Map<string, Signal[]>();
  for (const sensor of sensors) {
    bySensor.set(sensor.id, computeDerivedForSensor(sensor, series));
  }
  return bySensor;
}
