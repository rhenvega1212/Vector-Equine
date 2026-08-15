/** Vector section product config hooks (brief-08 / brief-07 / brief-11 / ship GA). */
export const VECTOR_CONFIG = {
  /** Real-time aid meters only when sensors are actually connected. */
  SENSORS_CONNECTED: false,
  /** Rider paywall for captured sessions — flip true at launch when Stripe rider tiers are ready. */
  RIDER_PAYWALL: false,
  /** Future combined rider + Trainer Business discount (unimplemented). */
  BUNDLE_DISCOUNT: null as number | null,
  /** Builder Lab at /train/lab (exports, sync stubs). Internal — not a rider promise. */
  CAPTURE_LAB: true,
  /** Prefer LiveKit when env is configured; otherwise transcript-only join still works. */
  CAPTURE_REQUIRE_LIVEKIT: false,
} as const;

/** Trainer Business SKU — back-office only; not shown in GA coach UI until real. */
export const TRAINER_BUSINESS_SKU = {
  name: "Trainer Business",
  priceLabel: "$49/mo",
  priceTbd: true,
} as const;
