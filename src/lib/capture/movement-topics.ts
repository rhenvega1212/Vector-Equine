/**
 * Movement vocabulary for called turns.
 *
 * The ask names a movement; the reply must be about that movement. Without this
 * the model answers from whatever homework is most recent, which is how a
 * leg-yield question came back as a canter pirouette progression.
 */

export type MovementTopic = {
  key: string;
  /** Spoken label used in prompts and checks. */
  label: string;
  /** Matches the ask and any prior homework text. */
  re: RegExp;
};

export const MOVEMENT_TOPICS: MovementTopic[] = [
  { key: "leg-yield", label: "leg yield", re: /\bleg[-\s]?yield(s|ing)?\b/i },
  {
    key: "shoulder-in",
    label: "shoulder-in",
    re: /\bshoulder[-\s]?in\b|\bshoulder[-\s]?fore\b/i,
  },
  {
    key: "haunches-in",
    label: "haunches-in",
    re: /\bhaunches[-\s]?in\b|\btravers\b|\brenvers\b/i,
  },
  {
    key: "half-pass",
    label: "half-pass",
    re: /\bhalf[-\s]?pass(es)?\b/i,
  },
  {
    key: "flying-change",
    label: "flying change",
    re: /\bflying[-\s]?change(s)?\b|\btempi\b/i,
  },
  {
    key: "counter-canter",
    label: "counter-canter",
    re: /\bcounter[-\s]?canter\b/i,
  },
  {
    key: "pirouette",
    label: "canter pirouette",
    re: /\bpirouette(s)?\b/i,
  },
  { key: "piaffe", label: "piaffe", re: /\bpiaffe\b/i },
  { key: "passage", label: "passage", re: /\bpassage\b/i,},
  {
    key: "rein-back",
    label: "rein-back",
    re: /\brein[-\s]?back\b|\bback\s+up\b/i,
  },
  {
    key: "transitions",
    label: "transitions",
    re: /\btransition(s)?\b|\bwalk[-\s]?canter\b|\bcanter[-\s]?walk\b/i,
  },
  {
    key: "half-halt",
    label: "half-halt",
    re: /\bhalf[-\s]?halt(s)?\b/i,
  },
  { key: "lengthen", label: "lengthening", re: /\blengthen(ing|ings)?\b|\bmedium\s+(trot|canter)\b|\bextend(ed|ing)?\b/i },
  { key: "collection", label: "collection", re: /\bcollect(ion|ed|ing)?\b/i },
  { key: "straightness", label: "straightness", re: /\bstraight(ness)?\b/i },
  { key: "bend", label: "bend", re: /\bbend(ing)?\b|\bsuppl(e|ing|eness)\b/i },
  { key: "contact", label: "contact", re: /\bcontact\b|\bon\s+the\s+bit\b/i },
  { key: "rhythm", label: "rhythm", re: /\brhythm\b|\btempo\b/i },
  { key: "circle", label: "circles", re: /\bcircle(s)?\b|\bvolte(s)?\b/i },
  { key: "serpentine", label: "serpentines", re: /\bserpentine(s)?\b/i },
  { key: "halt", label: "the halt", re: /\bhalt(s|ing)?\b/i },
  { key: "canter", label: "canter", re: /\bcanter(ing)?\b/i },
  { key: "trot", label: "trot", re: /\btrot(ting)?\b/i },
  { key: "walk", label: "walk", re: /\bwalk(ing)?\b/i },
];

/** Topics named in a line of speech, most specific first. */
export function extractMovementTopics(text: string): MovementTopic[] {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  return MOVEMENT_TOPICS.filter((topic) => topic.re.test(t));
}

/** The movement the reply must be about (most specific match wins). */
export function primaryMovementTopic(text: string): MovementTopic | null {
  return extractMovementTopics(text)[0] || null;
}

/** True when the reply actually addresses the movement that was asked. */
export function mentionsTopic(text: string, topic: MovementTopic): boolean {
  return topic.re.test(text || "");
}

/**
 * Named school movements. Everything else in the list (walk, rhythm, bend,
 * circles…) shows up inside a correct answer for any movement, so it cannot
 * be used as evidence that the reply drifted.
 */
const SPECIFIC_KEYS = new Set([
  "leg-yield",
  "shoulder-in",
  "haunches-in",
  "half-pass",
  "flying-change",
  "counter-canter",
  "pirouette",
  "piaffe",
  "passage",
  "rein-back",
]);

/**
 * The failure this guards is answering a different movement — a leg-yield ask
 * coming back as a canter pirouette. A reply that simply describes the aids
 * without repeating the label is not wrong, so it is not a retry.
 */
export function isOffTopicReply(text: string, topic: MovementTopic): boolean {
  if (mentionsTopic(text, topic)) return false;
  return MOVEMENT_TOPICS.some(
    (t) => t.key !== topic.key && SPECIFIC_KEYS.has(t.key) && t.re.test(text)
  );
}
