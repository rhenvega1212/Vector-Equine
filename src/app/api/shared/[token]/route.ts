import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * Public read-only debrief projection for anonymous share links.
 * Uses service role when available (preferred over relying on anon RLS alone).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Share links unavailable — service role not configured" },
        { status: 503 }
      );
    }

    const { token } = await params;
    const supabase = createAdminClient();

    const { data: link } = await supabase
      .from("share_links")
      .select("*")
      .eq("token", token)
      .eq("revoked", false)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    const { data: session } = await supabase
      .from("training_sessions")
      .select(
        "id, session_date, session_title, session_type, overall_feel, summary, homework, horse, horse_id, user_id"
      )
      .eq("id", link.session_id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user_id)
      .maybeSingle();

    let horseFirstName =
      (session.horse && String(session.horse).trim().split(/\s+/)[0]) || "Horse";

    if (session.horse_id) {
      const { data: horse } = await supabase
        .from("horse_profiles")
        .select("name, barn_name")
        .eq("id", session.horse_id)
        .maybeSingle();
      if (horse?.name) {
        horseFirstName = horse.barn_name?.trim() || horse.name.split(/\s+/)[0] || horse.name;
      }
    }

    const riderFirstName = (profile?.display_name || "Rider").split(/\s+/)[0] || "Rider";

    return NextResponse.json({
      score: session.overall_feel,
      summary: session.summary,
      homework: session.homework,
      session_date: session.session_date,
      session_title: session.session_title,
      horse_first_name: horseFirstName,
      rider_first_name: riderFirstName,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
