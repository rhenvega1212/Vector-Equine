import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

/**
 * Cron endpoint: archive scheduled challenges whose end_at has passed.
 * Call periodically (e.g. every 15 min) via Vercel Cron or external scheduler.
 * Optional: set CRON_SECRET and send Authorization: Bearer <CRON_SECRET> to protect.
 */
export async function POST(request: NextRequest) {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: count, error } = await admin.rpc("archive_ended_challenges");

    if (error) {
      console.error("archive_ended_challenges error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ archived_count: count ?? 0 });
  } catch (e) {
    console.error("Cron archive-challenges error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
