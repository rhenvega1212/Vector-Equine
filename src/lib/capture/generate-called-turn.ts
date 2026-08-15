import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  assertAttribution,
  formatHomeworkContext,
  type GroundingLevel,
  type HomeworkContextRow,
  type VectorOffer,
  stripOtherRiderIdentity,
} from "@/lib/capture/vector-turn";

const offerSchema = z.object({
  kind: z.enum(["answer", "exercise"]),
  text: z.string().min(1).max(4000),
  grounding: z.enum(["this-trainer", "general"]),
  spokenCategory: z.string().max(80),
  attributionPersonName: z.string().nullable(),
  attributionOccasion: z.string().nullable(),
  groundedReason: z.string().nullable(),
  sourceSessionId: z.string().nullable(),
});

export type CalledTurnResult = {
  offer: VectorOffer;
  crossingLine: string | null;
  model: string;
  latencyMs: number;
};

/**
 * Generate one called-turn reply. Levels 2–3 inert in v1.
 * Attribution names only when sourceSessionId is present in context.
 */
export async function generateCalledTurn(opts: {
  question: string;
  askedBy: "rider" | "trainer";
  riderFirst: string | null;
  trainerFirst: string | null;
  homeworkRows: HomeworkContextRow[];
  crossingLineAlreadySaid: boolean;
  declinedTexts?: string[];
}): Promise<CalledTurnResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }

  const modelId = "claude-haiku-4-5";
  const started = Date.now();
  const homeworkBlock = formatHomeworkContext(opts.homeworkRows);
  const hasLibrary = Boolean(homeworkBlock.trim());
  const trainerLabel = opts.trainerFirst?.trim() || "the trainer";
  const allowedSessionIds = new Set(
    opts.homeworkRows.map((r) => r.sessionId).filter(Boolean)
  );

  const anthropic = createAnthropic({ apiKey });
  const { object } = await generateObject({
    model: anthropic(modelId),
    schema: offerSchema,
    temperature: 0.4,
    system: `You are Vector in a live riding lesson. You assist the trainer; you never replace them.

Voice rules (absolute):
- Never use the string "AI".
- Never coach in Vector's own name. Prescriptive content quotes the trainer by name only when a homework record supports it, or describes an exercise without inventing a person.
- Sensors/history are facts only — no diagnosis, injury, lameness, prescribe, abnormal.
- Never grade the rider (no score/grade/verdict).
- Never name another rider. Strip other-rider identity.
- Level "this-trainer" only when homework context supports the reply; otherwise grounding must be "general".
- General answers MUST open with a clear marker clause such as "Generally —" or "Nothing on record for this —".
- Answer kind: under 25 words, one breath.
- Exercise kind: full steps, spoken end to end, paced with short beats between steps. No artificial length cap.
- attributionPersonName only when sourceSessionId is one of the supplied session ids. Otherwise null.
- Do not invent sourceSessionId values.

Trainer on channel: ${trainerLabel}.
Asker: ${opts.askedBy}.
Rider first name: ${opts.riderFirst || "unknown"}.`,
    prompt: `Question from the arena:
${opts.question}

Past free-text exercises / homework for this rider (may be empty):
${homeworkBlock || "(none on record)"}

Already declined this session (do not re-offer these):
${(opts.declinedTexts || []).join("\n") || "(none)"}

Return one offer.`,
  });

  let grounding: GroundingLevel = object.grounding;
  let text = stripOtherRiderIdentity(object.text.trim());
  let sourceSessionId =
    object.sourceSessionId && allowedSessionIds.has(object.sourceSessionId)
      ? object.sourceSessionId
      : undefined;
  let personName = object.attributionPersonName?.trim() || undefined;

  if (!hasLibrary || grounding !== "this-trainer" || !sourceSessionId) {
    grounding = "general";
    sourceSessionId = undefined;
    personName = undefined;
    if (!/^(generally|nothing on record)/i.test(text)) {
      text = `Generally — ${text.replace(/^(generally\s*[—–-]\s*)/i, "")}`;
    }
  }

  if (object.kind === "answer") {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 28) {
      text = words.slice(0, 25).join(" ");
    }
  }

  const offer: VectorOffer = {
    kind: object.kind,
    text,
    grounding,
    spokenCategory: object.spokenCategory || object.kind,
    provenance: {
      sourceSessionId,
      model: modelId,
    },
    attribution: personName
      ? {
          personName,
          occasion: object.attributionOccasion?.trim() || undefined,
        }
      : undefined,
    groundedReason: object.groundedReason,
  };

  try {
    assertAttribution(offer);
  } catch {
    offer.attribution = undefined;
    offer.provenance.sourceSessionId = undefined;
    offer.grounding = "general";
    if (!/^(generally|nothing on record)/i.test(offer.text)) {
      offer.text = `Generally — ${offer.text}`;
    }
  }

  let crossingLine: string | null = null;
  if (
    hasLibrary &&
    offer.grounding === "general" &&
    !opts.crossingLineAlreadySaid
  ) {
    crossingLine = `That's everything ${trainerLabel}'s given you for this. The rest are general.`;
  }

  return {
    offer,
    crossingLine,
    model: modelId,
    latencyMs: Date.now() - started,
  };
}
