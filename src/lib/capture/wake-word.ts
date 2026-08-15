/**
 * Hey Vector wake + turn intents — Brief 14 §5 / §6.
 * Detection runs against the local SpeechRecognition stream already used for
 * the lesson transcript (no separate cloud wake service).
 */

const WAKE_RE =
  /\b(?:hey|hay|okay|ok)\s+vector\b|\ba\s+vector\b/i;

const STOP_RE =
  /\b(stop|that'?s\s+enough|we'?re\s+good|never\s+mind|nevermind|okay\s+vector|ok\s+vector)\b/i;

const REPLAY_RE =
  /\b(say\s+that\s+again|repeat\s+that|one\s+more\s+time|from\s+the\s+top)\b/i;

const ADDRESSED_RE =
  /\b(hey|hay|okay|ok)?\s*vector\b|\bvector[,:]/i;

/** Residual after stripping the wake phrase (may be empty). */
export function splitWakeUtterance(raw: string): {
  hit: boolean;
  residual: string;
} {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || !WAKE_RE.test(text)) {
    return { hit: false, residual: "" };
  }
  const residual = text
    .replace(WAKE_RE, " ")
    .replace(/^[,.\s:-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
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

/** False wake / empty breath — produce zero output. */
export function isIntelligibleQuestion(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 3) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length >= 3;
}

/** Follow-up window: only clear address to Vector — ambiguous = silence. */
export function isAddressedToVector(text: string): boolean {
  return ADDRESSED_RE.test(text.replace(/\s+/g, " ").trim());
}

export function isStopPhrase(text: string): boolean {
  return STOP_RE.test(text.replace(/\s+/g, " ").trim());
}
