import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { executeScheduledPosts } from "@/lib/bots/engine";
import {
  generateDailyPlan,
  getCurrentLocalHour,
  getPostsForHour,
} from "@/lib/bots/scheduler";

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
    const currentHour = getCurrentLocalHour(now);
    const scheduled = getPostsForHour(plan, currentHour);

    if (scheduled.length === 0) {
      return NextResponse.json({
        status: "skipped",
        hour: currentHour,
        plan: {
          date: plan.date,
          quietDay: plan.isQuietDay,
          totalPosts: plan.posts.length,
          hours: plan.posts.map((p) => p.hour),
        },
      });
    }

    const results = await executeScheduledPosts(scheduled);

    return NextResponse.json({
      status: "posted",
      hour: currentHour,
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
