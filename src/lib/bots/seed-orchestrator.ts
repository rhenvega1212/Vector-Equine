import { TZDate } from "@date-fns/tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOT_IDS, SCHEDULE_CONFIG } from "./bot-config";
import { executeScheduledPosts } from "./engine";
import {
  addLocalCalendarDays,
  dateAnchorForLocalDay,
  generateDailyPlan,
  getTodayLocalDateString,
  listLocalCalendarDaysInclusive,
} from "./scheduler";

export interface DaySeedResult {
  date: string;
  status: "seeded" | "skipped_empty" | "partial" | "failed";
  plannedPosts: number;
  createdPosts: number;
  engagement?: { likes: number; comments: number };
  error?: string;
}

async function countBotPostsForLocalDate(
  admin: ReturnType<typeof createAdminClient>,
  dateStr: string,
  timeZone: string
): Promise<number> {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const start = new TZDate(y, mo - 1, d, 0, 0, 0, timeZone);
  const end = new TZDate(y, mo - 1, d, 23, 59, 59, 999, timeZone);
  const { count, error } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .in("author_id", BOT_IDS)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    console.error("countBotPostsForLocalDate:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * If bot posts exist for a day but seed_log is missing (failed log write or pre-log data),
 * upsert the log so we do not create duplicate posts.
 */
async function excludeDatesWithPostsButNoLog(
  admin: ReturnType<typeof createAdminClient>,
  missingFromLog: string[],
  timeZone: string
): Promise<string[]> {
  const stillMissing: string[] = [];
  for (const dateStr of missingFromLog) {
    const n = await countBotPostsForLocalDate(admin, dateStr, timeZone);
    if (n > 0) {
      const { error } = await admin.from("bot_feed_seed_log").upsert(
        { seed_date: dateStr, post_count: n },
        { onConflict: "seed_date" }
      );
      if (error) {
        console.error("bot_feed_seed_log heal upsert failed:", error);
        stillMissing.push(dateStr);
      }
      continue;
    }
    stillMissing.push(dateStr);
  }
  return stillMissing;
}

/**
 * Place the most recent calendar days first within the priority span (oldest→newest
 * among those), then older gaps (oldest→newest) so timestamps stay chronological.
 */
function prioritizeMissingDates(
  missing: string[],
  today: string,
  timeZone: string
): string[] {
  const span = SCHEDULE_CONFIG.seedRecentPrioritySpan;
  const priorityOrdered: string[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = addLocalCalendarDays(today, -i, timeZone);
    if (missing.includes(d)) priorityOrdered.push(d);
  }
  const rest = missing.filter((d) => !priorityOrdered.includes(d)).sort();
  return [...priorityOrdered, ...rest];
}

/**
 * Dates in [lookbackStart, today] that are not in bot_feed_seed_log.
 */
export async function findMissingSeedDates(
  admin: ReturnType<typeof createAdminClient>,
  options?: { lookbackDays?: number; timeZone?: string }
): Promise<string[]> {
  const tz = options?.timeZone ?? SCHEDULE_CONFIG.timezone;
  const lookback =
    options?.lookbackDays ?? SCHEDULE_CONFIG.seedBackfillLookbackDays;

  const today = getTodayLocalDateString(tz);
  const start = addLocalCalendarDays(today, -lookback, tz);
  const allDays = listLocalCalendarDaysInclusive(start, today, tz);

  const { data: rows, error } = await admin
    .from("bot_feed_seed_log")
    .select("seed_date")
    .gte("seed_date", start)
    .lte("seed_date", today);

  if (error) {
    console.error("bot_feed_seed_log query failed:", error);
    throw new Error(
      `bot_feed_seed_log unavailable: ${error.message}. Apply migration 20250321000000_bot_feed_seed_log.sql`
    );
  }

  const seeded = new Set(
    (rows ?? []).map((r: { seed_date: string }) => r.seed_date)
  );
  return allDays.filter((d) => !seeded.has(d));
}

/**
 * Seed missing days (recent window first), up to maxDaysPerRun.
 * Writes seed log on full success; upserts log when posts already exist for a day.
 */
export async function runBotSeedBackfill(): Promise<{
  processed: DaySeedResult[];
  remainingMissingEstimate: number;
}> {
  const admin = createAdminClient();
  const tz = SCHEDULE_CONFIG.timezone;
  const maxDays = SCHEDULE_CONFIG.seedMaxDaysPerRun;
  const today = getTodayLocalDateString(tz);

  const missingRaw = await findMissingSeedDates(admin);
  const missingNoDupes = await excludeDatesWithPostsButNoLog(
    admin,
    missingRaw,
    tz
  );
  const prioritized = prioritizeMissingDates(missingNoDupes, today, tz);
  const batch = prioritized.slice(0, maxDays);
  const remaining = Math.max(0, prioritized.length - batch.length);

  const processed: DaySeedResult[] = [];

  for (const dateStr of batch) {
    const anchor = dateAnchorForLocalDay(dateStr, tz);
    const plan = generateDailyPlan(anchor);

    if (plan.date !== dateStr) {
      processed.push({
        date: dateStr,
        status: "failed",
        plannedPosts: 0,
        createdPosts: 0,
        error: `Plan date mismatch: expected ${dateStr}, got ${plan.date}`,
      });
      continue;
    }

    if (plan.posts.length === 0) {
      processed.push({
        date: dateStr,
        status: "skipped_empty",
        plannedPosts: 0,
        createdPosts: 0,
      });
      continue;
    }

    const plannedCount = plan.posts.length;
    try {
      const out = await executeScheduledPosts(plan.posts, plan.date);
      const ok = out.posts.length === plannedCount;

      if (ok) {
        const { error: logErr } = await admin.from("bot_feed_seed_log").upsert(
          { seed_date: plan.date, post_count: out.posts.length },
          { onConflict: "seed_date" }
        );
        if (logErr) {
          console.error("bot_feed_seed_log upsert failed:", logErr);
        }
      }

      processed.push({
        date: plan.date,
        status: ok ? "seeded" : "partial",
        plannedPosts: plannedCount,
        createdPosts: out.posts.length,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Seed failed for ${dateStr}:`, e);
      processed.push({
        date: dateStr,
        status: "failed",
        plannedPosts: plannedCount,
        createdPosts: 0,
        error: message,
      });
    }
  }

  return { processed, remainingMissingEstimate: remaining };
}
