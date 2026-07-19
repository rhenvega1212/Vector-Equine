/**
 * Mock sensor generator (Phase 0, §8 / §3.3).
 *
 * Produces contract-conformant data for a single WIX-IMU rig at a realistic
 * sample rate. The engine cannot tell mock data from real hardware — that is
 * the point (§3.3). Real hardware must adapt *to* this same shape:
 *
 *   { sessionId, sensorId, signalKey, tMs, value }
 *
 * Everything is deterministic from `seed`, so a session always regenerates to
 * the same series (important for reproducible demos and round-trip export
 * tests).
 */
import type {
  Session,
  Sensor,
  Signal,
  SignalSeries,
  Placement,
  Entity,
  Discipline,
} from "../types";

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit seed so ids map to stable noise. */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The 10 raw signals a WIX-style IMU emits at once (§2.3). */
const IMU_SIGNAL_DEFS: Array<{
  key: string;
  label: string;
  unit: string;
  displayGroup: string;
}> = [
  { key: "accel_x", label: "Accel X", unit: "m/s²", displayGroup: "acceleration" },
  { key: "accel_y", label: "Accel Y", unit: "m/s²", displayGroup: "acceleration" },
  { key: "accel_z", label: "Accel Z", unit: "m/s²", displayGroup: "acceleration" },
  { key: "gyro_x", label: "Gyro X", unit: "°/s", displayGroup: "gyroscope" },
  { key: "gyro_y", label: "Gyro Y", unit: "°/s", displayGroup: "gyroscope" },
  { key: "gyro_z", label: "Gyro Z", unit: "°/s", displayGroup: "gyroscope" },
  { key: "orientation_w", label: "Orient W", unit: "quat", displayGroup: "orientation" },
  { key: "orientation_x", label: "Orient X", unit: "quat", displayGroup: "orientation" },
  { key: "orientation_y", label: "Orient Y", unit: "quat", displayGroup: "orientation" },
  { key: "orientation_z", label: "Orient Z", unit: "quat", displayGroup: "orientation" },
];

interface RigMember {
  placement: Placement;
  entity: Entity;
  serial: string;
}

/** Default rider+horse rig — enough signals to exercise the scale-down UX. */
const DEFAULT_RIG: RigMember[] = [
  { placement: "pelvis", entity: "rider", serial: "WIX-PEL-001" },
  { placement: "left_wrist", entity: "rider", serial: "WIX-LWR-002" },
  { placement: "right_wrist", entity: "rider", serial: "WIX-RWR-003" },
  { placement: "left_calf", entity: "rider", serial: "WIX-LCA-004" },
  { placement: "right_calf", entity: "rider", serial: "WIX-RCA-005" },
  { placement: "horse_withers", entity: "horse", serial: "WIX-HWI-006" },
];

export interface MockSessionOptions {
  id?: string;
  seed?: number;
  discipline?: Discipline;
  title?: string;
  riderId?: string;
  videoAssetUrl?: string;
  durationMs?: number;
  sampleRateHz?: number;
  rig?: RigMember[];
  /** deterministic-ish per-sensor start skew so the nudge control is meaningful */
  injectOffsets?: boolean;
}

const DEFAULT_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

/** Build session + sensor + signal *metadata* (no samples yet). */
export function generateMockSession(opts: MockSessionOptions = {}): Session {
  const id = opts.id ?? "mock-session-01";
  const seed = opts.seed ?? hashSeed(id);
  const rng = mulberry32(seed);
  const durationMs = opts.durationMs ?? 60_000;
  const sampleRateHz = opts.sampleRateHz ?? 100;
  const rig = opts.rig ?? DEFAULT_RIG;
  const sessionStartEpochMs = Date.parse("2026-06-01T14:00:00.000Z");

  const sensors: Sensor[] = rig.map((member, i) => {
    const sensorId = `${id}__sensor-${i + 1}`;
    const offsetMs = opts.injectOffsets
      ? Math.round((rng() - 0.5) * 240) // ±120ms skew to calibrate away
      : 0;
    const signals: Signal[] = IMU_SIGNAL_DEFS.map((def) => ({
      id: `${sensorId}__${def.key}`,
      sensorId,
      key: def.key,
      label: def.label,
      unit: def.unit,
      kind: "raw" as const,
      derivedFrom: null,
      displayGroup: def.displayGroup,
    }));
    return {
      id: sensorId,
      sessionId: id,
      deviceType: "imu_wix",
      deviceSerial: member.serial,
      placement: member.placement,
      entity: member.entity,
      sampleRateHz,
      offsetMs,
      calibration: null,
      signals,
    };
  });

  return {
    id,
    arenaId: null,
    riderId: opts.riderId ?? "rider-demo",
    discipline: opts.discipline ?? "dressage",
    title: opts.title ?? "Demo dressage session",
    videoAssetUrl: opts.videoAssetUrl ?? DEFAULT_VIDEO,
    recordedAt: new Date(sessionStartEpochMs).toISOString(),
    sessionStartEpochMs,
    durationMs,
    notes: "Synthetic WIX-IMU rig for engine development.",
    sensors,
  };
}

/**
 * Generate full-resolution raw sample series for every raw signal in a session.
 * Returned keyed by `${sensorId}:${signalKey}` (see seriesKey()).
 *
 * The waveform is a physically plausible superposition:
 *   - a slow "gait" oscillation (stride cadence),
 *   - a faster limb oscillation for wrist/calf sensors,
 *   - band-limited noise,
 *   - a couple of transient "events" (e.g. a jerk) so annotators have signal.
 */
export function generateMockSeries(session: Session): Map<string, SignalSeries> {
  const out = new Map<string, SignalSeries>();

  for (const sensor of session.sensors) {
    const n = Math.floor((session.durationMs / 1000) * sensor.sampleRateHz);
    const dtMs = 1000 / sensor.sampleRateHz;
    const limbFactor =
      sensor.placement.includes("wrist") || sensor.placement.includes("calf")
        ? 1.6
        : 1;

    for (const signal of sensor.signals) {
      if (signal.kind !== "raw") continue;
      const rng = mulberry32(hashSeed(signal.id));
      const t = new Float64Array(n);
      const v = new Float64Array(n);

      // per-signal character
      const strideHz = 2.4 + rng() * 0.4; // ~trot cadence
      const limbHz = strideHz * (2 + rng()); // limb moves faster
      const phase = rng() * Math.PI * 2;
      const isOrientation = signal.displayGroup === "orientation";
      const isGyro = signal.displayGroup === "gyroscope";
      const base = isOrientation ? 0.0 : isGyro ? 0 : signal.key === "accel_z" ? 9.81 : 0;
      const amp = isOrientation ? 0.15 : isGyro ? 40 : 3.5;
      const noiseAmp = isOrientation ? 0.02 : isGyro ? 6 : 0.6;

      // two transient events per signal to give annotators something to mark
      const eventA = 0.25 + rng() * 0.15;
      const eventB = 0.6 + rng() * 0.2;
      const eventWidth = 0.02;

      let smoothNoise = 0;
      for (let i = 0; i < n; i++) {
        const tMs = i * dtMs;
        const tSec = tMs / 1000;
        const frac = i / n;

        // band-limited noise via a leaky integrator
        smoothNoise = smoothNoise * 0.85 + (rng() - 0.5) * noiseAmp;

        const gait = amp * Math.sin(2 * Math.PI * strideHz * tSec + phase);
        const limb =
          amp * 0.5 * limbFactor * Math.sin(2 * Math.PI * limbHz * tSec + phase * 1.7);

        let event = 0;
        const dA = frac - eventA;
        const dB = frac - eventB;
        event += amp * 2.5 * Math.exp(-(dA * dA) / (2 * eventWidth * eventWidth));
        event -= amp * 1.8 * Math.exp(-(dB * dB) / (2 * eventWidth * eventWidth));

        let value = base + gait + limb + smoothNoise + event;
        if (isOrientation) {
          value = Math.max(-1, Math.min(1, value));
        }
        t[i] = tMs;
        v[i] = value;
      }

      out.set(seriesKey(sensor.id, signal.key), {
        sensorId: sensor.id,
        signalKey: signal.key,
        sampleRateHz: sensor.sampleRateHz,
        t,
        v,
      });
    }
  }

  return out;
}

export function seriesKey(sensorId: string, signalKey: string): string {
  return `${sensorId}:${signalKey}`;
}

/** Flatten series to contract rows — used by the exporter and for validation. */
export function seriesToContractRows(
  session: Session,
  series: Map<string, SignalSeries>
): Array<{
  sessionId: string;
  sensorId: string;
  signalKey: string;
  tMs: number;
  value: number;
}> {
  const rows: Array<{
    sessionId: string;
    sensorId: string;
    signalKey: string;
    tMs: number;
    value: number;
  }> = [];
  for (const s of Array.from(series.values())) {
    for (let i = 0; i < s.t.length; i++) {
      rows.push({
        sessionId: session.id,
        sensorId: s.sensorId,
        signalKey: s.signalKey,
        tMs: s.t[i],
        value: s.v[i],
      });
    }
  }
  return rows;
}
