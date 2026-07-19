/**
 * Vector Equine — Annotation Engine core domain types.
 *
 * These mirror the entity hierarchy from the architecture brief (§3.1):
 *
 *   Facility → Arena            [future]
 *      Session                  [v1 root]
 *         Rider → SensorSet
 *            Sensor             (one physical IMU)
 *               Signal          (accel_x, gyro_z, …)
 *
 * Stable IDs are assigned at every level so the arena/multi-rider layer can
 * slot on top later without a migration. Single-rider is a *view constraint*,
 * not a data-model constraint (§9).
 */

export type Discipline =
  | "dressage"
  | "jumping"
  | "eventing"
  | "reining"
  | "western"
  | "other";

export type Entity = "rider" | "horse";

export type DeviceType = "imu_wix" | "imu_wit" | "other";

/** Physical placement of a sensor on the rider or horse. */
export type Placement =
  | "head"
  | "torso"
  | "pelvis"
  | "left_wrist"
  | "right_wrist"
  | "left_upper_arm"
  | "right_upper_arm"
  | "left_thigh"
  | "right_thigh"
  | "left_calf"
  | "right_calf"
  | "left_foot"
  | "right_foot"
  | "horse_poll"
  | "horse_withers"
  | "horse_croup"
  | "other";

export type SignalKind = "raw" | "derived";

/** Recipe describing how a derived signal is computed from other signals. */
export interface DerivedRecipe {
  op: "magnitude" | "delta" | "jerk" | "angular_velocity_magnitude";
  /** signal keys this derivation consumes */
  of: string[];
}

/** A single output channel of a sensor (§2.3). */
export interface Signal {
  id: string;
  sensorId: string;
  /** e.g. 'accel_x' | 'gyro_z' | 'orientation_w' | 'movement_magnitude' */
  key: string;
  label: string;
  unit: string;
  kind: SignalKind;
  derivedFrom: DerivedRecipe | null;
  /** for track grouping in the UI, e.g. 'acceleration' | 'gyroscope' */
  displayGroup: string;
}

/** One physical IMU (§2.3, §3.2). A sensor is a *bundle of signals*. */
export interface Sensor {
  id: string;
  sessionId: string;
  deviceType: DeviceType;
  deviceSerial: string;
  placement: Placement;
  entity: Entity;
  sampleRateHz: number;
  /** per-sensor alignment vs the master clock (§5). Milliseconds. */
  offsetMs: number;
  calibration: Record<string, unknown> | null;
  signals: Signal[];
}

/** One ride (§3.2). The v1 root entity. */
export interface Session {
  id: string;
  /** nullable in v1 — the future arena layer will populate it */
  arenaId: string | null;
  riderId: string;
  discipline: Discipline;
  title: string;
  videoAssetUrl: string;
  recordedAt: string;
  /** master time base (§5): wall-clock epoch of t_ms = 0 */
  sessionStartEpochMs: number;
  /** authoritative for downsampling budget + timeline extent */
  durationMs: number;
  notes: string | null;
  sensors: Sensor[];
}

export type AnnotationSource = "human" | "model";

/**
 * An annotation targets a *set of signals* over a time range (§2.4).
 * Point event when startMs === endMs.
 */
export interface Annotation {
  id: string;
  sessionId: string;
  authorId: string;
  startMs: number;
  endMs: number;
  labelKey: string;
  labelVersion: string;
  freeText: string | null;
  confidence: number | null;
  /** 'human' in v1; the field that turns the labeler into a correction tool (§2.7) */
  source: AnnotationSource;
  modelVersion: string | null;
  /** many-to-many join (AnnotationTarget) resolved to signal ids (§3.2) */
  targetSignalIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** A single sensor sample — the data contract (§3.3). */
export interface SensorSample {
  sessionId: string;
  sensorId: string;
  signalKey: string;
  /** milliseconds from sessionStartEpochMs */
  tMs: number;
  value: number;
}

/**
 * Column-oriented, per-signal series. This is the in-memory representation the
 * engine holds full-resolution data in; the DOM only ever sees a downsampled
 * slice of it (§2.5, §2.6).
 */
export interface SignalSeries {
  sensorId: string;
  signalKey: string;
  sampleRateHz: number;
  /** parallel arrays; t[i] ↔ v[i] */
  t: Float64Array;
  v: Float64Array;
}
