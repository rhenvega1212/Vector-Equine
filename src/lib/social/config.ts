/**
 * Social / community product dials (brief-09).
 * Dial these without code archaeology when launching or expanding community.
 */
export const SOCIAL_CONFIG = {
  /** off = hide community entry; light = connection-scoped; full = global feed later */
  SOCIAL_MODE: "light" as "off" | "light" | "full",
  /** Gate explore depth and heavy community features */
  COMMUNITY_ENABLED: false,
  /** Outward share card / Web Share on Debrief */
  SHARE_OUTWARD_ENABLED: true,
} as const;
