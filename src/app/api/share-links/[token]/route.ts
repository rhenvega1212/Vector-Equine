import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ token: string }>;
}

async function loadSharedProjection(token: string) {
  const useService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useService ? createAdminClient() : await createClient();

  const { data: link, error: linkError } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .eq("revoked", false)
    .maybeSingle();

  if (linkError || !link) {
    return { error: "Share link not found", status: 404 as const };
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { error: "Share link has expired", status: 410 as const };
  }

  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .select(
      "id, session_date, session_title, session_type, overall_feel, summary, homework, horse, horse_id, user_id"
    )
    .eq("id", link.session_id)
    .maybeSingle();

  if (sessionError || !session) {
    return { error: "Session not found", status: 404 as const };
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

  return {
    projection: {
      score: session.overall_feel,
      summary: session.summary,
      homework: session.homework,
      session_date: session.session_date,
      session_title: session.session_title,
      horse_first_name: horseFirstName,
      rider_first_name: riderFirstName,
    },
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Share links unavailable — server misconfigured" },
        { status: 503 }
      );
    }

    const result = await loadSharedProjection(token);
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.projection);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
