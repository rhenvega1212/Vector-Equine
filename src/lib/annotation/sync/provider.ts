/**
 * The sync boundary (§5).
 *
 * The engine treats aligned time as *handed to it*, never computed by it.
 * Everything downstream depends only on this interface. The real mechanism
 * (hardware trigger, base-station timestamp, software clock sync) is owned by
 * the hardware/tech side and swaps in behind this interface with zero UI
 * changes.
 *
 * This boundary is why the engine build and the sync build do not block each
 * other.
 */
import type { Session, Sensor } from "../types";

export interface SessionTimeBase {
  sessionStartEpochMs: number;
}

export interface SyncProvider {
  /** Given a session, return the master time base. */
  getSessionTimeBase(sessionId: string): SessionTimeBase;
  /** Per-sensor offset (ms) correcting drift + start skew vs the video clock. */
  getSensorOffsetMs(sensorId: string): number;
}

/**
 * v1 trivial provider: offsets come straight from the Sensor rows, optionally
 * overridden by a per-session manual "nudge" map (the ±ms timeline control,
 * §5). Real hardware sync will replace this class, not its callers.
 */
export class TrivialSyncProvider implements SyncProvider {
  private readonly timeBaseBySession = new Map<string, SessionTimeBase>();
  private readonly baseOffsetBySensor = new Map<string, number>();
  private readonly nudgeBySensor = new Map<string, number>();

  constructor(session: Session) {
    this.timeBaseBySession.set(session.id, {
      sessionStartEpochMs: session.sessionStartEpochMs,
    });
    for (const sensor of session.sensors) {
      this.baseOffsetBySensor.set(sensor.id, sensor.offsetMs);
    }
  }

  getSessionTimeBase(sessionId: string): SessionTimeBase {
    const base = this.timeBaseBySession.get(sessionId);
    if (!base) {
      throw new Error(`No time base registered for session ${sessionId}`);
    }
    return base;
  }

  getSensorOffsetMs(sensorId: string): number {
    const base = this.baseOffsetBySensor.get(sensorId) ?? 0;
    const nudge = this.nudgeBySensor.get(sensorId) ?? 0;
    return base + nudge;
  }

  /** Manual per-sensor nudge (±ms) driven by the timeline control. */
  setNudge(sensorId: string, nudgeMs: number): void {
    this.nudgeBySensor.set(sensorId, nudgeMs);
  }

  getNudge(sensorId: string): number {
    return this.nudgeBySensor.get(sensorId) ?? 0;
  }
}

/**
 * Apply a sensor's alignment to convert a *sensor-local* time to *master-clock*
 * time. Kept as a free function so both rendering and export share one rule.
 */
export function toMasterTimeMs(
  sensorLocalTMs: number,
  provider: SyncProvider,
  sensor: Pick<Sensor, "id">
): number {
  return sensorLocalTMs + provider.getSensorOffsetMs(sensor.id);
}
