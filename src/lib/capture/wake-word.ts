/**
 * Hey Vector wake + turn intents — Brief 14 §5 / §6.
 * Detection runs against local SpeechRecognition and Whisper finals.
 */

import { isGarbageTurnText } from "@/lib/capture/asr-cleanup";

/** ASR punctuates the wake — "Hey, Vector." must match as readily as "Hey Vector". */
const GAP = "[,.\\s]+";

const WAKE_RE = new RegExp(
  `\\b(?:hey|hay|okay|ok|hi|yo)${GAP}(?:there${GAP})?(?:vector|victor|victa|nectar|vester|bector)\\b|\\ba${GAP}vector\\b`,
  "i"
);

const STOP_RE =
  /\b(stop|that'?s\s+enough|we'?re\s+good|never\s+mind|nevermind)\b/i;

const REPLAY_RE =
  /\b(say\s+that\s+again|repeat\s+that|one\s+more\s+time|from\s+the\s+top)\b/i;

const ADDRESSED_RE = /\bvector\b|\bvictor\b/i;

/** "No, I'm good" — closes the turn instead of asking again. */
const NEGATIVE_RE =
  /^(no|nope|nah|no\s+thanks?|that'?s\s+it|that'?s\s+all|i'?m\s+good|we'?re\s+good|all\s+good|nothing|nothing\s+else|i'?m\s+done|we'?re\s+done|done)\b/i;

/** "Yes" to an offer of more — keeps the turn open. */
const AFFIRMATIVE_RE = /^(yes|yeah|yep|yup|sure|please|one\s+more|another)\b/i;

export function isNegativeReply(text: string): boolean {
  return NEGATIVE_RE.test(text.replace(/\s+/g, " ").trim());
}

export function isAffirmativeReply(text: string): boolean {
  return AFFIRMATIVE_RE.test(text.replace(/\s+/g, " ").trim());
}

/** Residual after stripping the wake phrase (may be empty). */
export function splitWakeUtterance(raw: string): {
  hit: boolean;
  residual: string;
} {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || isGarbageTurnText(text)) {
    return { hit: false, residual: "" };
  }
  // Normalize common ASR mangling before the wake test
  const normalized = text
    .replace(/\bvictors?\b/gi, "Vector")
    .replace(/\bvicta\b/gi, "Vector")
    .replace(/\bnectar\b/gi, "Vector")
    .replace(/\bvester\b/gi, "Vector")
    .replace(/\bbector\b/gi, "Vector");

  // Prompt-echo lines often contain "Hey Vector" — never treat as a wake
  if (
    /\b(transcribe|speakers?\s+may|vocabulary|empty transcript)\b/i.test(
      normalized
    )
  ) {
    return { hit: false, residual: "" };
  }

  if (!WAKE_RE.test(normalized)) {
    return { hit: false, residual: "" };
  }
  const residual = normalized
    .replace(WAKE_RE, " ")
    .replace(/^[,.\s:;—–-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  // Residual that is still junk → wake-only (collect for a real ask)
  if (residual && isGarbageTurnText(residual)) {
    return { hit: true, residual: "" };
  }
  return { hit: true, residual };
}

export type TurnIntent = "stop" | "replay" | "ask";

export function classifyTurnIntent(question: string): TurnIntent {
  const q = question.replace(/\s+/g, " ").trim();
  if (!q) return "ask";
  if (STOP_RE.test(q) && q.length < 48) return "stop";
  if (REPLAY_RE.test(q)) return "replay";
  return "ask";
}

/** False wake / empty breath / prompt junk — produce zero output. */
export function isIntelligibleQuestion(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 3) return false;
  if (isGarbageTurnText(t)) return false;
  const letters = t.replace(/[^A-Za-z']/g, "");
  if (letters.length < 3) return false;
  // Reject pure wake leftovers / non-asks that are just noise words
  if (/^(hey\s+)?vector\.?$/i.test(t)) return false;
  return looksLikeRidingAsk(t);
}

/**
 * Called turns only fire on riding asks — not ambient barn chatter
 * that happened to land after a wake.
 */
export function looksLikeRidingAsk(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return false;
  if (/\?/.test(t)) return true;
  if (
    /\b(how|what|why|when|where|which|can you|could you|would you|should i|do i|am i|give me|tell me|help|remind|exercise|work on|how's|hows|please|next|again)\b/.test(
      t
    )
  ) {
    return true;
  }
  if (
    /\b(trot|canter|walk|gallop|halt|half-halt|rein|leg|seat|hands|circle|diagonal|pirouette|piaffe|passage|yield|transition|tempo|rhythm|collection|contact|bend|shoulder-in|haunches|flying change|balance|forward|straight|aid|aids|horse|ride|riding|lesson)\b/.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

/** Follow-up window: only clear address to Vector — ambiguous = silence. */
export function isAddressedToVector(text: string): boolean {
  return ADDRESSED_RE.test(text.replace(/\s+/g, " ").trim());
}

export function isStopPhrase(text: string): boolean {
  return STOP_RE.test(text.replace(/\s+/g, " ").trim());
}
