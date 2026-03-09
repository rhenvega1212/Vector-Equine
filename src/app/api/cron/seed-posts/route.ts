import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { executeScheduledPosts } from "@/lib/bots/engine";
import { generateDailyPlan } from "@/lib/bots/scheduler";

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const plan = generateDailyPlan(now);

    if (plan.posts.length === 0) {
      return NextResponse.json({
        status: "skipped",
        plan: { date: plan.date, quietDay: plan.isQuietDay, totalPosts: 0 },
      });
    }

    // On Hobby plan the cron fires once daily, so create all of today's
    // posts in a single run. Each post already carries a unique hour and
    // minuteOffset from the deterministic plan — the engine uses those to
    // backdate created_at so posts appear spread across the day.
    const results = await executeScheduledPosts(plan.posts);

    return NextResponse.json({
      status: "posted",
      plan: {
        date: plan.date,
        quietDay: plan.isQuietDay,
        totalPosts: plan.posts.length,
      },
      ...results,
    });
  } catch (e) {
    console.error("Cron seed-posts error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
