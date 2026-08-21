/**
 * Brief 14 called-turn types + context assembly (levels 1 + 4 for v1).
 * Level 2 inert; level 3 = follow-on corpus (Phase 5b).
 */

import type { MovementTopic } from "@/lib/capture/movement-topics";

export type GroundingLevel =
  | "this-trainer"
  | "other-trainer"
  | "published"
  | "general";

export type VectorOffer = {
  kind: "answer" | "exercise";
  text: string;
  grounding: GroundingLevel;
  spokenCategory: string;
  provenance: {
    sourceSessionId?: string;
    trainerId?: string;
    corpusChunkId?: string;
    citation?: string;
    model: string;
  };
  attribution?: {
    personName?: string;
    occasion?: string;
  };
  groundedReason?: string | null;
  response?: "accepted" | "declined" | "no-reply" | "trainer-took-over";
};

export type VectorTurn = {
  sessionId: string;
  askedAtMs: number;
  askedBy: "rider" | "trainer";
  question: string;
  offers: VectorOffer[];
  spoken: boolean;
  interrupted: boolean;
};

/** A personName may only appear when provenance carries a matching record. */
export function assertAttribution(offer: VectorOffer): void {
  const name = offer.attribution?.personName?.trim();
  if (!name) return;
  const p = offer.provenance;
  const ok =
    Boolean(p.sourceSessionId) ||
    Boolean(p.corpusChunkId && p.citation);
  if (!ok) {
    throw new Error(
      "Fabricated attribution: personName without sourceSessionId or corpusChunkId+citation"
    );
  }
}

export function stripOtherRiderIdentity(text: string): string {
  // Soften common cross-roster leaks; full strip is assembly-time.
  return text.replace(/\b(to|for)\s+[A-Z][a-z]{1,20}\b/g, "").replace(/\s{2,}/g, " ").trim();
}

export type HomeworkContextRow = {
  sessionId: string;
  trainerId: string | null;
  trainerName: string | null;
  sessionDate: string;
  exercises: string | null;
  homework: string | null;
  overallFeel: number | null;
  feelScale: 5 | 10 | null;
};

/**
 * Prior records that actually worked the movement being asked about.
 * Everything else is noise — feeding it in is what made Vector answer
 * a leg-yield question with the most recent canter homework.
 */
export function filterHomeworkByTopic(
  rows: HomeworkContextRow[],
  topic: MovementTopic | null
): HomeworkContextRow[] {
  if (!topic) return [];
  return rows.filter((r) =>
    topic.re.test(`${r.exercises || ""}\n${r.homework || ""}`)
  );
}

/**
 * Assemble level-1 context from free-text homework (no exercise library).
 * Caller strips other-rider identity before sending to the model.
 */
export function formatHomeworkContext(rows: HomeworkContextRow[]): string {
  if (rows.length === 0) return "";
  return rows
    .map((r) => {
      const who = r.trainerName || "Trainer";
      const body = [r.exercises, r.homework].filter(Boolean).join("\n");
      if (!body.trim()) return null;
      const feel =
        r.overallFeel != null && r.feelScale != null
          ? ` feel=${r.overallFeel}/${r.feelScale}`
          : "";
      return `[${r.sessionDate}] ${who} (session ${r.sessionId})${feel}:\n${stripOtherRiderIdentity(body)}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
