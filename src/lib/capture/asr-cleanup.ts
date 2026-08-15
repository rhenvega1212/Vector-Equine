/**
 * Light cleanup for browser SpeechRecognition before segments hit the timeline.
 * Not a substitute for Whisper — just fixes the common barn / Vector mangling.
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
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.t || alts[0].transcript.trim();
}

export function cleanAsrText(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return text;

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

  return text.trim();
}
