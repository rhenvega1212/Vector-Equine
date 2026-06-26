import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { runBotSeedBackfill } from "@/lib/bots/seed-orchestrator";
import { runEngagementPass } from "@/lib/bots/engine";

/**
 * Vercel Cron Jobs invoke this route with **GET** (not POST).
 * @see https://vercel.com/docs/cron-jobs
 *
 * Fills missing bot posts for each local calendar day (America/New_York):
 * - Prioritizes the last `seedRecentPrioritySpan` days (today + past days) so recent
 *   activity is not blocked by older backlog.
 * - Heals seed log when bot posts already exist for a day but the log row is missing.
 * - Backfills up to `seedMaxDaysPerRun` days per run after that.
 * - Requires `bot_feed_seed_log` migration for idempotency.
 *
 * Manual triggers: same URL with POST and optional `?force=1` (reserved; same as GET for now).
 */
async function verifyCronAuth(): Promise<boolean> {
  const headersList = await headers();
  const authHeader =
    headersList.get("authorization") ?? headersList.get("Authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return token === secret;
}

function checkSupabaseEnv(): NextResponse | null {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for bot seeding.",
      },
      { status: 503 }
    );
  }
  return null;
}

async function runHandler() {
  const bad = checkSupabaseEnv();
  if (bad) return bad;

  try {
    const { processed, remainingMissingEstimate } = await runBotSeedBackfill();
    const seeded = processed.filter((p) => p.status === "seeded").length;
    const partial = processed.filter((p) => p.status === "partial").length;
    const failed = processed.filter((p) => p.status === "failed").length;

    // Always top up engagement on recent posts, even when there's nothing new to
    // seed, so existing posts (real users included) keep gaining likes/comments.
    let engagement = { likes: 0, comments: 0 };
    try {
      engagement = await runEngagementPass();
    } catch (engErr) {
      console.error("Engagement pass error:", engErr);
    }

    return NextResponse.json({
      status:
        processed.length === 0 && engagement.likes === 0 && engagement.comments === 0
          ? "nothing_to_do"
          : "ok",
      summary: {
        daysProcessed: processed.length,
        daysSeeded: seeded,
        daysPartial: partial,
        daysFailed: failed,
        remainingMissingEstimate,
        engagement,
      },
      processed,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Cron seed-posts error:", e);
    if (message.includes("bot_feed_seed_log")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  if (!(await verifyCronAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runHandler();
}

export async function POST(_request: NextRequest) {
  if (!(await verifyCronAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runHandler();
}
