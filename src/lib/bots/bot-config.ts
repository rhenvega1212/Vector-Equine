// =============================================================================
// SCHEDULE CONFIGURATION
// All the knobs for controlling bot posting behavior in one place.
// =============================================================================

export const SCHEDULE_CONFIG = {
  /** Average total posts per day across all bots */
  dailyPostTarget: 3,

  /** [min, max] posts on a normal day. Weighted toward dailyPostTarget. */
  dailyPostRange: [2, 4] as const,

  /** Chance (0-1) of a "quiet day" with only 1-2 posts */
  quietDayChance: 0.15,

  /** Posting window start (hour 0-23 in the timezone below) */
  activeHoursStart: 7,

  /** Posting window end (hour 0-23 in the timezone below) */
  activeHoursEnd: 21,

  /** IANA timezone string for calculating active hours */
  timezone: "America/New_York",

  /** Approximate fraction of posts that include a photo (0.33 ≈ 1 in 3) */
  photoRatio: 0.33,

  /** Minimum gap in hours between any two posts in a single day */
  minHoursBetweenPosts: 2,

  /** Number of days before a photo can be reused. 95 photos / ~1 per day = ~95 days */
  mediaCooldownDays: 60,

  /** Cap photos per photo-post to keep the 95-image pool lasting months */
  maxPhotosPerPost: 1,

  /**
   * How far back (local calendar days) we look for missing bot seed runs.
   * Recent days (see seedRecentPrioritySpan) are always processed before older gaps.
   */
  seedBackfillLookbackDays: 60,

  /** Max calendar days to seed in one cron run (avoid Vercel timeout). */
  seedMaxDaysPerRun: 14,

  /**
   * When backfilling, always prioritize this many local calendar days ending today
   * (e.g. 3 = today + yesterday + day before) so recent activity is never stuck
   * behind a long historical backlog.
   */
  seedRecentPrioritySpan: 3,
};

// =============================================================================
// BOT PROFILE TYPES
// =============================================================================

export interface BotProfile {
  id: string;
  username: string;
  displayName: string;
  discipline: string;
  contentAffinity: string[];

  /**
   * How often this bot gets picked to post on a given day.
   * heavy  → appears multiple times per week, core "regular" user
   * medium → a few times per week
   * light  → once a week or less
   * rare   → very occasional, lurker who sometimes surfaces
   */
  postFrequency: "heavy" | "medium" | "light" | "rare";

  /**
   * What kind of posts this bot leans toward.
   * text  → mostly text-only, occasionally overridden to photo
   * photo → mostly photo posts, occasionally overridden to text
   * mixed → no preference, follows the day's plan as-is
   */
  preferredType: "text" | "photo" | "mixed";
}

// =============================================================================
// BOT PROFILES
// 10 bots with varied personalities so the feed looks like distinct real people.
//
// Frequency distribution:
//   3 heavy  → the core regulars (Jessica, Hannah, Marcus)
//   3 medium → active but not every day (Oliver, Sophia, Lily)
//   2 light  → once a week at most (Ryan, James)
//   2 rare   → lurkers who pop up occasionally (Natalie, Daniel)
//
// On any given day, typically 2-4 of these will be selected to post.
// The weighted selection plus the repeat-penalty in the scheduler means
// you'll see a natural rotation rather than the same faces every day.
// =============================================================================

export const BOT_PROFILES: BotProfile[] = [
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    username: "jessicamtrails",
    displayName: "Jessica Martinez",
    discipline: "western",
    contentAffinity: ["western", "trail-riding", "horse-care"],
    postFrequency: "heavy",
    preferredType: "mixed",
  },
  {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    username: "oliverrides",
    displayName: "Oliver Chen",
    discipline: "dressage",
    contentAffinity: ["dressage", "training", "competition"],
    postFrequency: "medium",
    preferredType: "text",
  },
  {
    id: "1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76",
    username: "hannahb_equine",
    displayName: "Hannah Brooks",
    discipline: "eventing",
    contentAffinity: ["eventing", "training", "competition"],
    postFrequency: "heavy",
    preferredType: "photo",
  },
  {
    id: "9e107d9d-372b-4a8a-80f2-e9e15d24a06b",
    username: "ryano_rides",
    displayName: "Ryan O'Sullivan",
    discipline: "jumping",
    contentAffinity: ["jumping", "training", "mindset"],
    postFrequency: "light",
    preferredType: "text",
  },
  {
    id: "6ba7b810-9dad-41d4-80b5-72c26d5a9f9e",
    username: "sophiaeq",
    displayName: "Sophia Andersson",
    discipline: "dressage",
    contentAffinity: ["dressage", "competition", "training"],
    postFrequency: "medium",
    preferredType: "photo",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440012",
    username: "marcuswrides",
    displayName: "Marcus Williams",
    discipline: "western",
    contentAffinity: ["western", "horse-care", "trail-riding"],
    postFrequency: "heavy",
    preferredType: "mixed",
  },
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    username: "lilyp_eventing",
    displayName: "Lily Patel",
    discipline: "eventing",
    contentAffinity: ["eventing", "horse-care", "competition"],
    postFrequency: "medium",
    preferredType: "text",
  },
  {
    id: "8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d",
    username: "jcooper_eq",
    displayName: "James Cooper",
    discipline: "jumping",
    contentAffinity: ["jumping", "training", "competition"],
    postFrequency: "light",
    preferredType: "mixed",
  },
  {
    id: "2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f",
    username: "natkim_trails",
    displayName: "Natalie Kim",
    discipline: "western",
    contentAffinity: ["trail-riding", "western", "mindset"],
    postFrequency: "rare",
    preferredType: "text",
  },
  {
    id: "b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a",
    username: "dreeves_dressage",
    displayName: "Daniel Reeves",
    discipline: "dressage",
    contentAffinity: ["dressage", "training", "horse-care"],
    postFrequency: "rare",
    preferredType: "mixed",
  },
];

export const BOT_IDS = BOT_PROFILES.map((b) => b.id);
