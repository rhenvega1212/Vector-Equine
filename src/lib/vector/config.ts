/** Vector section product config hooks (brief-08 / brief-07). */
export const VECTOR_CONFIG = {
  /** Real-time aid meters only when sensors are actually connected. */
  SENSORS_CONNECTED: false,
  /** Soft free-coach roster cap before Trainer Business upsell. */
  FREE_COACH_MAX_RIDERS: 5,
  /** Rider paywall teaser vs full history — product dial. */
  RIDER_PAYWALL: true,
  /** Future combined rider + Trainer Business discount (unimplemented). */
  BUNDLE_DISCOUNT: null as number | null,
} as const;
