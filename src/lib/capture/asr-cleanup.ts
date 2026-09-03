/**
 * Light cleanup for browser SpeechRecognition / Whisper before segments hit the timeline.
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
 * Whisper silence / prompt-echo leftovers. Drop entirely (no transcript row).
 */
const HALLUCINATION_EXACT_RE =
  /^(thanks?(?:\s+you)?\s+for\s+watching\.?|thanks?(?:\s+you)?\s+for\s+listening\.?|please\s+subscribe\.?|like\s+and\s+subscribe\.?|see\s+you\s+(?:next\s+time|later)\.?|subscribe\.?|thank\s+you\.?|thanks\.?|you\.?|bye\.?|goodbye\.?|music\.?|applause\.?|transcribe\s+only\s+clear\s+speech\.?|speakers?\s+may\s+say\b.*|equestrian\s+riding\s+lesson\b.*|\.{1,}|…)$/i;

/** Substrings that mean the model echoed its own prompt or spun nonsense. */
const HALLUCINATION_CONTAINS_RE =
  /transcribe\s+only|speakers?\s+may\s+say|return\s+an\s+empty\s+transcript|never\s+invent\s+filler|thank(?:s| you)\s+for\s+watching|please\s+subscribe|like\s+and\s+subscribe|speech\s+violence|featuring\s+strangulation|violence\s+against\s+women|\[.?music.?\]|\[.?applause.?\]|字幕|subscribe\s+to\s+my/i;

/** Comma-stacked gait lists = Whisper dumping the vocab prompt. */
const VOCAB_DUMP_RE =
  /\bwalk\b.*\btrot\b.*\bcanter\b|\btrot\b.*\bcanter\b.*\bhalt\b|\binside\s+leg\b.*\boutside\s+rein\b.*\b(contact|collection|tempo)\b/i;

/**
 * Rule names are stored on flagged rows and queried in `transcript_flag_audit`.
 * Renaming one orphans the history that proves whether the rule is any good.
 */
export type HallucinationRule =
  | "empty"
  | "boilerplate"
  | "prompt_echo"
  | "vocab_dump"
  | "watermark_short"
  | "subscribe_short"
  | "prompt_shaped"
  | "short_crumb";

/**
 * Which rule considers this text a hallucination, or null for none.
 * Every rule here has false positives — flag on it, never delete on it.
 */
export function classifyHallucination(raw: string): HallucinationRule | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "empty";
  if (HALLUCINATION_EXACT_RE.test(text)) return "boilerplate";
  if (HALLUCINATION_CONTAINS_RE.test(text)) return "prompt_echo";
  if (VOCAB_DUMP_RE.test(text)) return "vocab_dump";
  if (/thank(?:s| you)\s+for\s+watching/i.test(text) && text.length < 48) {
    return "watermark_short";
  }
  if (
    /please\s+subscribe|like\s+and\s+subscribe/i.test(text) &&
    text.length < 64
  ) {
    return "subscribe_short";
  }
  // Prompt-shaped: long instructional sentence with no riding ask
  if (
    text.length > 40 &&
    /\b(transcribe|transcript|speakers?\s+may|vocabulary|silent or only noise)\b/i.test(
      text
    )
  ) {
    return "prompt_shaped";
  }
  // Very short non-riding crumbs Whisper invents on hiss.
  // Highest false-positive rate of any rule here — a real "No." looks like this.
  if (
    text.length <= 12 &&
    /^(the|a|and|so|to|of|in|it|is|this|that|yeah|yes|no)\.?$/i.test(text)
  ) {
    return "short_crumb";
  }
  return null;
}

export function isWhisperHallucination(raw: string): boolean {
  return classifyHallucination(raw) !== null;
}

/**
 * Text that must never start or fill a called turn — prompt echo, junk, etc.
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
    // Penalize prompt-echo candidates
    if (HALLUCINATION_CONTAINS_RE.test(t) || VOCAB_DUMP_RE.test(t)) score -= 0.8;
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.t || alts[0].transcript.trim();
}

export function cleanAsrText(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return text;
  if (isWhisperHallucination(text)) return "";

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

  if (isWhisperHallucination(text)) return "";
  return text.trim();
}
