import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrainingSessionSchema } from "@/lib/validations/training-session";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const range = searchParams.get("range") || "30"; // 7, 30, 90
    const horse = searchParams.get("horse") || "";
    const sessionType = searchParams.get("session_type") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const fromDate = new Date();
    if (range === "7") fromDate.setDate(fromDate.getDate() - 7);
    else if (range === "30") fromDate.setDate(fromDate.getDate() - 30);
    else fromDate.setDate(fromDate.getDate() - 90);

    let query = supabase
      .from("training_sessions")
      .select("*")
      .eq("user_id", user.id)
      .gte("session_date", fromDate.toISOString().split("T")[0])
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (horse) query = query.eq("horse", horse);
    if (sessionType) query = query.eq("session_type", sessionType);

    const { data: sessions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ sessions: sessions || [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTrainingSessionSchema.parse(body);

    const payload = {
      user_id: user.id,
      session_date: parsed.session_date,
      horse: parsed.horse.trim(),
      session_type: parsed.session_type,
      overall_feel: parsed.overall_feel,
      discipline: parsed.discipline || null,
      exercises: parsed.exercises || null,
      notes: parsed.notes || null,
      rhythm: parsed.rhythm ?? null,
      relaxation: parsed.relaxation ?? null,
      connection: parsed.connection ?? null,
      impulsion: parsed.impulsion ?? null,
      straightness: parsed.straightness ?? null,
      collection: parsed.collection ?? null,
      competition_prep: parsed.competition_prep ?? false,
      focused_goal_session: parsed.focused_goal_session ?? false,
      video_link_url: parsed.video_link_url || null,
    };

    const { data: session, error } = await supabase
      .from("training_sessions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
