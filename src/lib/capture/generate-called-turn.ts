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
import {
  isOffTopicReply,
  isExerciseAskNeedingMovement,
  mentionsTopic,
  primaryMovementTopic,
  type MovementTopic,
} from "@/lib/capture/movement-topics";

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

export type PriorTurn = {
  question: string;
  answer: string;
};

export type CalledTurnResult = {
  offer: VectorOffer;
  crossingLine: string | null;
  model: string;
  latencyMs: number;
};

/** Spoken exercises stay rideable in one hearing. */
const EXERCISE_WORD_CAP = 90;
const ANSWER_WORD_CAP = 28;

function capWords(text: string, cap: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= cap) return text;
  const trimmed = words.slice(0, cap).join(" ");
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Generate one called-turn reply. Levels 2–3 inert in v1.
 * Attribution names only when sourceSessionId is present in context.
 */
export async function generateCalledTurn(opts: {
  question: string;
  askedBy: "rider" | "trainer";
  riderFirst: string | null;
  trainerFirst: string | null;
  /** Already filtered to records that worked the movement being asked about. */
  homeworkRows: HomeworkContextRow[];
  crossingLineAlreadySaid: boolean;
  declinedTexts?: string[];
  /** Recent exchanges so a correction lands as conversation, not a fresh ask. */
  priorTurns?: PriorTurn[];
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

  const priorTurns = (opts.priorTurns || []).slice(-3);
  // A correction refers back to the previous ask ("that's not a leg yield")
  const topic: MovementTopic | null =
    primaryMovementTopic(opts.question) ||
    primaryMovementTopic(priorTurns[priorTurns.length - 1]?.question || "");

  if (isExerciseAskNeedingMovement(opts.question) && !topic) {
    return {
      offer: {
        kind: "answer",
        text: "Which movement?",
        grounding: "general",
        spokenCategory: "clarify",
        provenance: { model: modelId },
      },
      crossingLine: null,
      model: modelId,
      latencyMs: Date.now() - started,
    };
  }

  const topicRule = topic
    ? `The rider asked about ${topic.label}. Every word of the reply must be about ${topic.label}, and the reply must name ${topic.label}. Never substitute a different movement. If no prior record below worked ${topic.label}, give a general ${topic.label} exercise from your own knowledge — do not refuse.`
    : `Answer exactly what was asked. Never substitute a different movement or a different question.`;

  const anthropic = createAnthropic({ apiKey });

  const system = `You are Vector in a live riding lesson. You assist the trainer; you never replace them.

Accuracy first:
- ${topicRule}
- Prior records below are only usable if they worked that same movement. If none do, answer generally — never repurpose unrelated homework.
- Wrong movement is the only unacceptable answer. Empty records are not a reason to refuse: answer generally instead.
- "Nothing on record" is only for questions about what someone previously said or did. If the rider asks for an exercise or how to ride something, always give one — for that movement.

Voice rules (absolute):
- Never use the string "AI".
- Never coach in Vector's own name. Prescriptive content quotes the trainer by name only when a homework record supports it, or describes an exercise without inventing a person.
- Sensors/history are facts only — no diagnosis, injury, lameness, prescribe, abnormal.
- Never grade the rider (no score/grade/verdict).
- Never name another rider. Strip other-rider identity.
- Level "this-trainer" only when a prior record below worked this movement; otherwise grounding must be "general".
- When a record below worked this movement, build the reply from it and set grounding "this-trainer" with that record's sourceSessionId. Do this even when no person's name is available — leave attributionPersonName null and do not invent one. The rider's own record always beats a generic answer.
- General answers MUST open with a clear marker clause such as "Generally —" or "Nothing on record for this —".
- Answer kind: under 25 words, one breath.
- Exercise kind: 3 to 5 short commands a rider can ride in the next 30 seconds, under ${EXERCISE_WORD_CAP} words. Second person, imperative. Name the movement. Arena language — inside leg, outside rein, track, steps, circle. No numbered warmup essay. No "focus on even tempo." Never walk-trot-canter laps unless they asked for a warmup.
- Shape (content changes with the movement): "Generally — 10m circle at the letter. As the shoulders hit the track, keep the bend and ride forward — that's shoulder-in. Inside leg to outside rein. Three or four steps. Straighten."
- attributionPersonName only when sourceSessionId is one of the supplied session ids. Otherwise null.
- Do not invent sourceSessionId values.

Trainer on channel: ${trainerLabel}.
Asker: ${opts.askedBy}.
Rider first name: ${opts.riderFirst || "unknown"}.`;

  const conversationBlock = priorTurns.length
    ? priorTurns
        .map((t) => `Rider: ${t.question}\nVector: ${t.answer}`)
        .join("\n\n")
    : "(this is the first exchange)";

  const prompt = `Earlier in this conversation:
${conversationBlock}

Question from the arena:
${opts.question}

Prior records for this rider that worked ${topic ? topic.label : "this"} (may be empty):
${homeworkBlock || "(none on record)"}

Already declined this session (do not re-offer these):
${(opts.declinedTexts || []).join("\n") || "(none)"}

Return one offer.`;

  async function callModel(extraRule?: string) {
    const { object } = await generateObject({
      model: anthropic(modelId),
      schema: offerSchema,
      temperature: 0.3,
      maxOutputTokens: 500,
      system: extraRule ? `${system}\n\n${extraRule}` : system,
      prompt,
    });
    return object;
  }

  let object = await callModel();

  // On-topic guard — repair to a general exercise for the movement actually
  // asked. Refusing is the last resort, never the shortcut.
  if (topic && isOffTopicReply(object.text, topic)) {
    if (process.env.VECTOR_TURN_DEBUG) {
      console.log(`[off-topic retry] ${topic.label} <- "${object.text}"`);
    }
    object = await callModel(
      `Your previous attempt did not work ${topic.label}. Give a general ${topic.label} exercise in 3 to 5 short commands a rider can ride now, opening with "Generally —". Name ${topic.label}. Imperative, second person. Do not refuse, do not mention any other school movement, and do not give a walk-trot-canter warmup.`
    );
    if (!mentionsTopic(object.text, topic)) {
      object = {
        ...object,
        kind: "answer" as const,
        grounding: "general" as const,
        sourceSessionId: null,
        attributionPersonName: null,
        text: `Nothing on record for ${topic.label} — bring it to your next lesson.`,
      };
    }
  }

  if (process.env.VECTOR_TURN_DEBUG) {
    console.log("[raw model]", {
      grounding: object.grounding,
      sourceSessionId: object.sourceSessionId,
      attributionPersonName: object.attributionPersonName,
      allowed: Array.from(allowedSessionIds),
      hasLibrary,
    });
  }

  let grounding: GroundingLevel = object.grounding;
  let text = stripOtherRiderIdentity(object.text.trim());
  let sourceSessionId =
    object.sourceSessionId && allowedSessionIds.has(object.sourceSessionId)
      ? object.sourceSessionId
      : undefined;
  let personName = object.attributionPersonName?.trim() || undefined;

  // A name is only ever echoed back, never invented. "Emma" from a record is
  // fine; "Emma Winter" when we only ever knew "Emma" is not, and neither is
  // the placeholder the model reaches for when no name was supplied.
  if (personName) {
    const known = [
      opts.trainerFirst,
      ...opts.homeworkRows.map((r) => r.trainerName),
    ]
      .map((n) => n?.trim().toLowerCase())
      .filter((n): n is string => Boolean(n));
    const tokens = personName.toLowerCase().split(/\s+/).filter(Boolean);
    const isPlaceholder = /^(the|your|my)?\s*(trainer|coach|instructor|unknown)$/i.test(
      personName
    );
    const vouched = known.some((k) => {
      const kt = new Set(k.split(/\s+/));
      return tokens.every((t) => kt.has(t));
    });
    if (isPlaceholder || !vouched) personName = undefined;
  }

  if (!hasLibrary || grounding !== "this-trainer" || !sourceSessionId) {
    grounding = "general";
    sourceSessionId = undefined;
    personName = undefined;
    if (!/^(generally|nothing on record)/i.test(text)) {
      text = `Generally — ${text.replace(/^(generally\s*[—–-]\s*)/i, "")}`;
    }
  } else {
    // Grounded in the rider's own record — "Generally" would misdescribe it
    text = text.replace(/^generally\s*[—–-]\s*/i, "");
  }

  text =
    object.kind === "answer"
      ? capWords(text, ANSWER_WORD_CAP)
      : capWords(text, EXERCISE_WORD_CAP);

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
  // "That's everything they've given you" only makes sense once the rider has
  // actually turned something down — on a first ask it is a non-sequitur.
  if (
    hasLibrary &&
    (opts.declinedTexts?.length || 0) > 0 &&
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
