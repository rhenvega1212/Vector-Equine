import { TZDate } from "@date-fns/tz";
import { BOT_PROFILES, SCHEDULE_CONFIG, type BotProfile } from "./bot-config";

// =============================================================================
// TYPES
// =============================================================================

export interface PlannedPost {
  /** Hour of day (0-23) in the configured timezone */
  hour: number;
  /** Minutes past the hour to backdate created_at for natural timestamps */
  minuteOffset: number;
  bot: BotProfile;
  type: "text" | "photo";
}

export interface DailyPlan {
  date: string;
  isQuietDay: boolean;
  posts: PlannedPost[];
}

// =============================================================================
// SEEDED PRNG
//
// The core trick: given the same date string, this always produces the same
// sequence of "random" numbers. That means the cron can fire 24 times a day
// and every invocation will regenerate the identical daily plan, so each one
// knows whether this particular hour has a post or not — with zero state.
// =============================================================================

function createRng(dateStr: string): () => number {
  let hash = 5381;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) + hash + dateStr.charCodeAt(i)) | 0;
  }
  let s = hash | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// =============================================================================
// TIMEZONE HELPERS
// =============================================================================

function getLocalDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: SCHEDULE_CONFIG.timezone,
  });
}

export function getCurrentLocalHour(date: Date): number {
  const h = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SCHEDULE_CONFIG.timezone,
      hour: "numeric",
      hour12: false,
    }).format(date),
    10
  );
  return h === 24 ? 0 : h;
}

/** Today's calendar date in the feed timezone (YYYY-MM-DD). */
export function getTodayLocalDateString(
  timeZone: string = SCHEDULE_CONFIG.timezone
): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

/**
 * Anchor instant (noon local) for a calendar day string, for deterministic plans.
 * `generateDailyPlan(anchor)` must yield `plan.date === dateStr`.
 */
export function dateAnchorForLocalDay(
  dateStr: string,
  timeZone: string = SCHEDULE_CONFIG.timezone
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new TZDate(y, m - 1, d, 12, 0, 0, timeZone);
}

/** Add calendar days in the feed timezone; returns YYYY-MM-DD. */
export function addLocalCalendarDays(
  dateStr: string,
  deltaDays: number,
  timeZone: string = SCHEDULE_CONFIG.timezone
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new TZDate(y, m - 1, d, 12, 0, 0, timeZone);
  t.setDate(t.getDate() + deltaDays);
  return t.toLocaleDateString("en-CA", { timeZone });
}

/** Inclusive range of local calendar date strings (sorted ascending). */
export function listLocalCalendarDaysInclusive(
  fromInclusive: string,
  toInclusive: string,
  timeZone: string = SCHEDULE_CONFIG.timezone
): string[] {
  const out: string[] = [];
  let cur = fromInclusive;
  while (cur <= toInclusive) {
    out.push(cur);
    if (cur === toInclusive) break;
    cur = addLocalCalendarDays(cur, 1, timeZone);
  }
  return out;
}

// =============================================================================
// DAILY PLAN GENERATION
//
// Runs deterministically from the date. Decides:
//   1. How many posts today (2-4 normally, 1-2 on quiet days)
//   2. Which hours they land in (spaced apart by minHoursBetweenPosts)
//   3. Which bot creates each post (weighted, penalizes same-day repeats)
//   4. Whether each post is text-only or photo+text
// =============================================================================

const FREQUENCY_WEIGHTS: Record<string, number> = {
  heavy: 5,
  medium: 3,
  light: 1.5,
  rare: 0.5,
};

export function generateDailyPlan(date: Date): DailyPlan {
  const config = SCHEDULE_CONFIG;
  const dateStr = getLocalDateString(date);
  const rng = createRng(dateStr);

  // --- How many posts today? ---
  const isQuietDay = rng() < config.quietDayChance;
  let postCount: number;

  if (isQuietDay) {
    postCount = rng() < 0.6 ? 2 : 1;
  } else {
    const [min, max] = config.dailyPostRange;
    const roll = rng();
    if (roll < 0.25) postCount = min;
    else if (roll < 0.75) postCount = config.dailyPostTarget;
    else postCount = max;
  }

  // --- Pick hours, spread across the day ---
  const windowSize = config.activeHoursEnd - config.activeHoursStart;
  const hours: number[] = [];

  for (let i = 0; i < postCount; i++) {
    let hour: number;
    let attempts = 0;
    do {
      hour = config.activeHoursStart + Math.floor(rng() * windowSize);
      attempts++;
    } while (
      attempts < 30 &&
      hours.some((h) => Math.abs(h - hour) < config.minHoursBetweenPosts)
    );
    hours.push(hour);
  }
  hours.sort((a, b) => a - b);

  // --- Select bots for each slot ---
  // Weighted random selection with a heavy penalty for picking the same bot
  // twice in one day. This means on a 3-post day you almost always get 3
  // different bots, but it's not impossible for a heavy poster to appear twice.
  const selectedBots: BotProfile[] = [];

  for (let i = 0; i < postCount; i++) {
    const usedIds = new Set(selectedBots.map((b) => b.id));
    const weights = BOT_PROFILES.map((b) => {
      const base = FREQUENCY_WEIGHTS[b.postFrequency] ?? 1;
      return usedIds.has(b.id) ? base * 0.1 : base;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let idx = 0;
    for (let j = 0; j < weights.length; j++) {
      roll -= weights[j];
      if (roll <= 0) {
        idx = j;
        break;
      }
    }
    selectedBots.push(BOT_PROFILES[idx]);
  }

  // --- Decide which slots are photo posts ---
  // Target ~1 photo post per 3 total posts. On a 2-post day that's 0 or 1.
  const photoCount = Math.round(postCount * config.photoRatio);
  const slotIndices = Array.from({ length: postCount }, (_, i) => i);
  for (let i = slotIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slotIndices[i], slotIndices[j]] = [slotIndices[j], slotIndices[i]];
  }
  const photoSlots = new Set(slotIndices.slice(0, photoCount));

  // --- Assemble the plan ---
  const posts: PlannedPost[] = hours.map((hour, i) => {
    let type: "text" | "photo" = photoSlots.has(i) ? "photo" : "text";
    const bot = selectedBots[i];

    // Let each bot's personality nudge the type.
    // A text-leaning bot assigned a photo slot may swap to text (50% chance).
    // A photo-leaning bot assigned a text slot may swap to photo (30% chance).
    if (type === "photo" && bot.preferredType === "text" && rng() < 0.5) {
      type = "text";
    } else if (
      type === "text" &&
      bot.preferredType === "photo" &&
      rng() < 0.3
    ) {
      type = "photo";
    }

    return {
      hour,
      minuteOffset: Math.floor(rng() * 47) + 3,
      bot,
      type,
    };
  });

  return { date: dateStr, isQuietDay, posts };
}

// =============================================================================
// HOUR-BASED LOOKUP
// The cron fires every hour. This returns only the posts planned for that hour.
// =============================================================================

export function getPostsForHour(
  plan: DailyPlan,
  hour: number
): PlannedPost[] {
  return plan.posts.filter((p) => p.hour === hour);
}
