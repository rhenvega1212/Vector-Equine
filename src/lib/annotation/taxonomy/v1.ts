/**
 * Vector Equine — Label Taxonomy v1 (§3.4).
 *
 * Structured, versioned enums — NOT free text. Every annotation stores a
 * `labelKey` + `labelVersion` so the taxonomy can evolve without corrupting
 * old labels. `freeText` on an annotation is a supplementary note only.
 *
 * The content here is a well-structured stub intended to be extended by the
 * domain team. Adding a label = add an entry. Changing the *meaning* of an
 * existing key = ship a new taxonomy version, never mutate v1.
 */

export const TAXONOMY_VERSION = "v1" as const;

/** Top-level grouping of what an annotation is about. */
export type LabelCategory =
  | "aid" // rider-applied aids
  | "execution" // quality of a movement/figure
  | "timing" // correctness of timing
  | "gait" // gait / tempo events
  | "fault" // errors and unwanted events
  | "note"; // neutral marker

export interface LabelDef {
  key: string;
  category: LabelCategory;
  label: string;
  description: string;
  /** does this label expect a graded quality? */
  gradable?: boolean;
}

/** Optional graded quality attached to gradable labels. */
export const EXECUTION_QUALITY = [
  "poor",
  "developing",
  "correct",
  "excellent",
] as const;
export type ExecutionQuality = (typeof EXECUTION_QUALITY)[number];

export const TIMING_CORRECTNESS = ["early", "on_time", "late"] as const;
export type TimingCorrectness = (typeof TIMING_CORRECTNESS)[number];

/**
 * The label registry. Keys are stable, namespaced strings.
 * Extend freely; do not repurpose an existing key.
 */
export const LABELS_V1: readonly LabelDef[] = [
  // --- Aids -------------------------------------------------------------
  { key: "aid.leg.left", category: "aid", label: "Left leg aid", description: "Left leg applied.", gradable: true },
  { key: "aid.leg.right", category: "aid", label: "Right leg aid", description: "Right leg applied.", gradable: true },
  { key: "aid.rein.left", category: "aid", label: "Left rein aid", description: "Left rein contact/half-halt.", gradable: true },
  { key: "aid.rein.right", category: "aid", label: "Right rein aid", description: "Right rein contact/half-halt.", gradable: true },
  { key: "aid.seat.weight", category: "aid", label: "Seat / weight aid", description: "Weight or seat shift.", gradable: true },
  { key: "aid.half_halt", category: "aid", label: "Half-halt", description: "Coordinated rebalancing aid.", gradable: true },

  // --- Execution --------------------------------------------------------
  { key: "execution.transition.up", category: "execution", label: "Upward transition", description: "Transition to a more forward gait.", gradable: true },
  { key: "execution.transition.down", category: "execution", label: "Downward transition", description: "Transition to a slower gait.", gradable: true },
  { key: "execution.circle", category: "execution", label: "Circle", description: "Circle figure.", gradable: true },
  { key: "execution.lateral.leg_yield", category: "execution", label: "Leg yield", description: "Leg-yield lateral movement.", gradable: true },
  { key: "execution.lateral.shoulder_in", category: "execution", label: "Shoulder-in", description: "Shoulder-in lateral movement.", gradable: true },
  { key: "execution.halt", category: "execution", label: "Halt", description: "Square halt.", gradable: true },
  { key: "execution.jump", category: "execution", label: "Jump effort", description: "A single jump effort.", gradable: true },

  // --- Timing -----------------------------------------------------------
  { key: "timing.aid_application", category: "timing", label: "Aid timing", description: "Timing of an aid relative to the stride.", gradable: true },
  { key: "timing.release", category: "timing", label: "Release timing", description: "Timing of a rein release.", gradable: true },

  // --- Gait -------------------------------------------------------------
  { key: "gait.walk", category: "gait", label: "Walk", description: "Walk phase.", gradable: false },
  { key: "gait.trot", category: "gait", label: "Trot", description: "Trot phase.", gradable: false },
  { key: "gait.canter", category: "gait", label: "Canter", description: "Canter phase.", gradable: false },
  { key: "gait.tempo_change", category: "gait", label: "Tempo change", description: "Notable change in tempo.", gradable: false },

  // --- Faults -----------------------------------------------------------
  { key: "fault.loss_of_balance", category: "fault", label: "Loss of balance", description: "Horse or rider loses balance.", gradable: false },
  { key: "fault.rein.jerk", category: "fault", label: "Rein jerk", description: "Abrupt, unintended rein action.", gradable: false },
  { key: "fault.against_hand", category: "fault", label: "Against the hand", description: "Horse resists the contact.", gradable: false },
  { key: "fault.break_of_gait", category: "fault", label: "Break of gait", description: "Unintended change of gait.", gradable: false },

  // --- Note -------------------------------------------------------------
  { key: "note.marker", category: "note", label: "Marker", description: "Neutral point of interest.", gradable: false },
] as const;

const LABEL_INDEX = new Map(LABELS_V1.map((l) => [l.key, l]));

export function getLabel(key: string): LabelDef | undefined {
  return LABEL_INDEX.get(key);
}

export function labelsByCategory(): Record<LabelCategory, LabelDef[]> {
  const out: Record<LabelCategory, LabelDef[]> = {
    aid: [],
    execution: [],
    timing: [],
    gait: [],
    fault: [],
    note: [],
  };
  for (const l of LABELS_V1) out[l.category].push(l);
  return out;
}

export const CATEGORY_LABELS: Record<LabelCategory, string> = {
  aid: "Aids",
  execution: "Execution",
  timing: "Timing",
  gait: "Gait",
  fault: "Faults",
  note: "Notes",
};
