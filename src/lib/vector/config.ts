/** Vector section product config hooks (brief-08 / brief-07 / brief-11). */
export const VECTOR_CONFIG = {
  /** Real-time aid meters only when sensors are actually connected. */
  SENSORS_CONNECTED: false,
  /** Soft free-coach roster cap before Trainer Business upsell. */
  FREE_COACH_MAX_RIDERS: 5,
  /** Rider paywall for captured sessions — flip true at launch when Stripe rider tiers are ready. */
  RIDER_PAYWALL: false,
  /** Future combined rider + Trainer Business discount (unimplemented). */
  BUNDLE_DISCOUNT: null as number | null,
  /** Builder Lab at /train/lab (exports, sync stubs). */
  CAPTURE_LAB: true,
  /** Prefer LiveKit when env is configured; otherwise transcript-only join still works. */
  CAPTURE_REQUIRE_LIVEKIT: false,
} as const;

/** Placeholder Trainer Business SKU — price TBD; do not hardcode Stripe ids. */
export const TRAINER_BUSINESS_SKU = {
  name: "Trainer Business",
  priceLabel: "$49/mo",
  priceTbd: true,
} as const;
