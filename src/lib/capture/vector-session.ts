/**
 * Brief 14 session bookends and feel types.
 * Feel lives on training_sessions (durable ride).
 * Utterances live on capture_sessions (live room).
 */

export type FeelScale = 5 | 10;

export type Feel = {
  rideId: string;
  value: number | null;
  scale: FeelScale | null;
  askedAtMs: number | null;
  answeredAtMs: number | null;
  deferrals: number;
};

export const FEEL_LABELS = {
  low: "1 · a fight",
  high: "5 · effortless",
} as const;

export function openBookendLine(opts: {
  riderFirst: string | null;
  trainerFirst: string | null;
}): string {
  const rider = opts.riderFirst?.trim() || null;
  const trainer = opts.trainerFirst?.trim() || null;
  if (rider && trainer) {
    return `Vector Equine. ${rider}, ${trainer} — you're both on. Capturing from here.`;
  }
  if (rider) {
    return `Vector Equine. You're on, ${rider}. Capturing from here.`;
  }
  return `Vector Equine. You're on. Capturing from here.`;
}

export const CLOSE_BOOKEND = "That's it — capture's off.";

/** No-wake escape: strip + ON/OFF must not render. */
export type VectorSessionUiMode = "full" | "bookends_only";
