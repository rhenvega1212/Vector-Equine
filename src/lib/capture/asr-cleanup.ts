/**
 * Two jobs, two functions. They must not share a return value.
 *
 * - `classifyHallucination` names a rule. It never rewrites text.
 * - `cleanAsrText` rewrites wording. It never decides a line is junk and
 *   never turns a real utterance into an empty string.
 *
 * Readers choose what to do with a flag. Cleanup must not make that choice
 * by returning nothing.
 */

const PHRASE_FIXES: Array<[RegExp, string]> = [
  // Wake / product name — highest priority
  [
    /\bhey\s+(victor|victors|victa|vectora|vectors|vester|nectar|lector|letter|bector)\b/gi,
    "Hey Vector",
  ],
  [/\ba\s+vector\b/gi, "Hey Vector"],
  [/\bhay\s+vector\b/gi, "Hey Vector"],
  [/\bhey\s+vector\b/gi, "Hey Vector"],
  [/\bokay\s+vector\b/gi, "Hey Vector"],
  [/\bok\s+vector\b/gi, "Hey Vector"],
  // Standalone product
  [/\bvictors?\b/gi, "Vector"],
  [/\bvector equine\b/gi, "Vector Equine"],
  // Aids / gaits / common lesson vocabulary
  [/\bhalve?\s*halt\b/gi, "half-halt"],
  [/\bhalf\s+halt\b/gi, "half-halt"],
  [/\bleg\s+ye?ild\b/gi, "leg yield"],
  [/\bshoulder(?:[-\s]+shoulder)+[-\s]?in\b/gi, "shoulder-in"],
  [/\bshoulder\s+in\b/gi, "shoulder-in"],
  [/\bhaunches\s+in\b/gi, "haunches-in"],
  [/\bcounter\s+canter\b/gi, "counter-canter"],
  [/\bflying\s+change(s)?\b/gi, "flying change$1"],
  [/\binside\s+leg\b/gi, "inside leg"],
  [/\boutside\s+rein\b/gi, "outside rein"],
  [/\b20\s*m(eter)?\b/gi, "20m"],
  [/\btwenty\s*meter\b/gi, "20m"],
  [/\bpirouette(s)?\b/gi, "pirouette$1"],
  [/\bpassage\b/gi, "passage"],
  [/\bpiaffe\b/gi, "piaffe"],
];

/**
 * Whole-segment Whisper leftovers. Kept as a regex because some entries are
 * prefix shapes (`speakers may say…`) that still describe the entire line.
 */
const HALLUCINATION_EXACT_RE =
  /^(thanks?(?:\s+you)?\s+for\s+watching\.?|thanks?(?:\s+you)?\s+for\s+listening\.?|please\s+subscribe\.?|like\s+and\s+subscribe\.?|see\s+you\s+(?:next\s+time|later)\.?|subscribe\.?|thank\s+you\.?|thanks\.?|you\.?|bye\.?|goodbye\.?|music\.?|applause\.?|transcribe\s+only\s+clear\s+speech\.?|speakers?\s+may\s+say\b.*|equestrian\s+riding\s+lesson\b.*|\.{1,}|…)$/i;

/**
 * Prompt-echo phrases, matched only as the whole segment after case and
 * whitespace (and a trailing stop) are normalised. A human quoting one of
 * these inside a longer line must not match. watermark_short / subscribe_short
 * lived here as unreachable extras; their phrases are this list.
 */
const PROMPT_ECHO_PHRASES = [
  "transcribe only",
  "transcribe only clear speech",
  "speakers may say",
  "return an empty transcript",
  "never invent filler",
  "thanks for watching",
  "thank you for watching",
  "thanks for listening",
  "thank you for listening",
  "please subscribe",
  "like and subscribe",
  "speech violence",
  "featuring strangulation",
  "violence against women",
  "[music]",
  "[applause]",
  "字幕",
  "subscribe to my",
];

function normalizePhrase(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
}

const PROMPT_ECHO_EXACT = new Set(PROMPT_ECHO_PHRASES.map(normalizePhrase));

/**
 * Rule names are stored on flagged rows and queried in `transcript_flag_audit`.
 * Renaming one orphans the history that proves whether the rule is any good.
 * Retired names (short_crumb, vocab_dump, prompt_shaped, watermark_short,
 * subscribe_short, empty) must not be reused for a different test.
 */
export type HallucinationRule = "boilerplate" | "prompt_echo";

/**
 * Which rule considers this text a hallucination, or null for none.
 * Never rewrites the string. Empty input is not a hallucination rule —
 * `flagSegment` names that `empty`.
 */
export function classifyHallucination(raw: string): HallucinationRule | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (HALLUCINATION_EXACT_RE.test(text)) return "boilerplate";
  if (PROMPT_ECHO_EXACT.has(normalizePhrase(text))) return "prompt_echo";
  return null;
}

export function isWhisperHallucination(raw: string): boolean {
  return classifyHallucination(raw) !== null;
}

/**
 * Text that must never start or fill a called turn — prompt echo, junk, etc.
 * This is not a transcript reader. It refuses to open a Vector turn.
 */
export function isGarbageTurnText(raw: string): boolean {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (isWhisperHallucination(text)) return true;
  // Wake-only with no residual handled elsewhere; here: pure noise phrases
  if (/^(um+|uh+|ah+|oh+|hmm+|mm+|yeah|yep|ok|okay)\.?$/i.test(text)) {
    return true;
  }
  return false;
}

/** Prefer the alternative that already says Vector / Hey Vector when present. */
export function pickBestAsrAlternative(
  alts: Array<{ transcript: string; confidence?: number }>
): string {
  if (alts.length === 0) return "";
  const scored = alts.map((a, i) => {
    const t = (a.transcript || "").trim();
    let score = typeof a.confidence === "number" ? a.confidence : 0.5 - i * 0.05;
    if (/hey\s+vector/i.test(t)) score += 0.35;
    if (/\bvector\b/i.test(t)) score += 0.15;
    if (/\b(trot|canter|halt|rein|leg)\b/i.test(t)) score += 0.05;
    if (classifyHallucination(t)) score -= 0.8;
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.t || alts[0].transcript.trim();
}

/**
 * Tidies wording. Never classifies. Never returns empty when the input had
 * a non-whitespace character — if a rewrite would collapse the line, the
 * original wording is kept.
 */
export function cleanAsrText(raw: string): string {
  const original = raw.replace(/\s+/g, " ").trim();
  if (!original) return raw;

  let text = original;
  for (const [re, rep] of PHRASE_FIXES) {
    text = text.replace(re, rep);
  }

  // Sentence case only when the whole blob came back SHOUTING
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 8 && letters === letters.toUpperCase()) {
    text = text.toLowerCase().replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) =>
      m.toUpperCase()
    );
    text = text.replace(/\bHey Vector\b/gi, "Hey Vector");
    text = text.replace(/\bVector Equine\b/gi, "Vector Equine");
  }

  return text.trim() || original;
}

/**
 * Wording a person should read. Uses the stored cleaned column when present,
 * otherwise tidies `text` at read time. Falls back to verbatim if tidy would
 * have nothing to show — readers must not treat an empty string as a delete.
 */
export function displayTranscriptText(
  raw: string,
  textCleaned?: string | null
): string {
  const fromCol = textCleaned?.replace(/\s+/g, " ").trim();
  if (fromCol) return fromCol;
  const cleaned = cleanAsrText(raw);
  if (cleaned) return cleaned;
  return raw.replace(/\s+/g, " ").trim();
}
