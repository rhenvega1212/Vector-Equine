/**
 * Demo session catalog. Assembles mock sessions (metadata + full-res series +
 * derived signals) that the workspace loads. Real sessions will come from the
 * database + sensor time-series store instead, behind the same shapes.
 */
import type { Session, SignalSeries } from "./types";
import {
  generateMockSession,
  generateMockSeries,
  type MockSessionOptions,
} from "./mock/generate";
import { computeDerivedForSession } from "./derived";

export interface DemoSessionSpec extends MockSessionOptions {
  id: string;
  title: string;
}

export const DEMO_SESSIONS: DemoSessionSpec[] = [
  {
    id: "demo-dressage-01",
    title: "Dressage — training level test",
    discipline: "dressage",
    durationMs: 90_000,
    sampleRateHz: 100,
    injectOffsets: true,
  },
  {
    id: "demo-jumping-01",
    title: "Show jumping — gymnastic grid",
    discipline: "jumping",
    durationMs: 60_000,
    sampleRateHz: 100,
    injectOffsets: true,
  },
];

export function getDemoSpec(id: string): DemoSessionSpec | undefined {
  return DEMO_SESSIONS.find((s) => s.id === id);
}

export interface AssembledSession {
  session: Session;
  series: Map<string, SignalSeries>;
}

/**
 * Build a complete session: mock metadata → full-res raw series → derived
 * signals attached to each sensor + added to the series map.
 */
export function assembleSession(spec: DemoSessionSpec): AssembledSession {
  const session = generateMockSession(spec);
  const series = generateMockSeries(session);
  const derivedBySensor = computeDerivedForSession(session.sensors, series);
  for (const sensor of session.sensors) {
    const derived = derivedBySensor.get(sensor.id) ?? [];
    sensor.signals = [...sensor.signals, ...derived];
  }
  return { session, series };
}
