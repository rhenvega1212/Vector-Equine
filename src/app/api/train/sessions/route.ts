import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { createTrainingSessionSchema } from "@/lib/validations/training-session";
import { assertCanCaptureSession } from "@/lib/vector/billing";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const { searchParams } = request.nextUrl;
    const range = searchParams.get("range") || "30"; // 7, 30, 90
    const horse = searchParams.get("horse") || "";
    const horseId = searchParams.get("horse_id") || "";
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

    if (horseId) query = query.eq("horse_id", horseId);
    else if (horse) query = query.eq("horse", horse);
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

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const gate = await assertCanCaptureSession(user.id);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason, reason: gate.reason }, { status: 402 });
    }

    const body = await request.json();
    const parsed = createTrainingSessionSchema.parse(body);

    const payload: Record<string, unknown> = {
      user_id: user.id,
      session_date: parsed.session_date,
      horse: (parsed.horse && parsed.horse.trim()) || null,
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
      session_source: parsed.session_source ?? "manual",
      summary: parsed.summary?.trim() || null,
      homework: parsed.homework?.trim() || null,
    };

    // Optional columns — only include when present so legacy schemas still accept inserts.
    if (parsed.horse_id) payload.horse_id = parsed.horse_id;
    if (parsed.session_title?.trim()) payload.session_title = parsed.session_title.trim();
    if (parsed.duration_minutes != null) payload.duration_minutes = parsed.duration_minutes;
    if (parsed.location?.trim()) payload.location = parsed.location.trim();
    if (parsed.video_upload_path) payload.video_upload_path = parsed.video_upload_path;
    if (parsed.trainer_id) payload.trainer_id = parsed.trainer_id;
    for (const key of [
      "ride_quality",
      "horse_energy",
      "responsiveness",
      "balance",
      "suppleness",
      "rider_position",
      "rider_effectiveness",
      "focus",
      "confidence",
      "progress_today",
      "soundness",
      "stamina",
      "behavior_attitude",
    ] as const) {
      const v = parsed[key];
      if (v != null) payload[key] = v;
    }

    // Legacy session_type CHECK may not allow dressage/flat_ride yet.
    const legacyTypeMap: Record<string, string> = {
      dressage: "lesson",
      flat_ride: "ride",
      jump_school: "lesson",
      trail_ride: "hack",
      lunge: "groundwork",
      show: "other",
      rehab: "conditioning",
    };

    const insertOnce = (body: Record<string, unknown>) =>
      supabase.from("training_sessions").insert(body).select().single();

    let { data: session, error } = await insertOnce(payload);

    // Strip unknown columns (PGRST204) and retry once.
    if (error?.code === "PGRST204" || /Could not find the .* column/i.test(error?.message || "")) {
      const missing = error?.message?.match(/'([^']+)' column/)?.[1];
      if (missing && missing in payload) {
        delete payload[missing];
        ({ data: session, error } = await insertOnce(payload));
      }
    }

    // Map expanded session_type → legacy if CHECK fails.
    if (error && /session_type/i.test(error.message) && legacyTypeMap[String(payload.session_type)]) {
      payload.session_type = legacyTypeMap[String(payload.session_type)];
      // Prefer title in notes when session_title was stripped
      if (parsed.session_title?.trim() && !payload.session_title) {
        payload.notes = [parsed.session_title.trim(), parsed.notes].filter(Boolean).join(" — ");
      }
      ({ data: session, error } = await insertOnce(payload));
    }

    // If still failing on optional columns, drop them all and retry base insert.
    if (error?.code === "PGRST204" || /Could not find the .* column/i.test(error?.message || "")) {
      const baseOnly = { ...payload };
      for (const k of [
        "horse_id",
        "session_title",
        "duration_minutes",
        "location",
        "video_upload_path",
        "ride_quality",
        "horse_energy",
        "responsiveness",
        "balance",
        "suppleness",
        "rider_position",
        "rider_effectiveness",
        "focus",
        "confidence",
        "progress_today",
        "soundness",
        "stamina",
        "behavior_attitude",
        "trainer_id",
      ]) {
        delete baseOnly[k];
      }
      ({ data: session, error } = await insertOnce(baseOnly));
    }

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
