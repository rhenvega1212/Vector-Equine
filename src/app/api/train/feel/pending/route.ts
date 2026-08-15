import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { isFlagEnabled } from "@/lib/flags/server";

const WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Most recent unanswered feel within 48h (blocking sheet).
 * One ride only — never a queue.
 */
export async function GET() {
  try {
    const { user, profile } = await getCurrentProfile();
    if (!user || !profile) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const enabled = await isFlagEnabled("vector_feel_prompt", profile);
    if (!enabled) {
      return NextResponse.json({ pending: null });
    }

    const supabase = await createClient();
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();

    const { data, error } = await supabase
      .from("training_sessions")
      .select(
        "id, session_date, horse, notes, overall_feel, feel_asked_at, feel_answered_at, feel_deferrals, created_at"
      )
      .eq("user_id", user.id)
      .is("overall_feel", null)
      .not("feel_asked_at", "is", null)
      .gte("feel_asked_at", cutoff)
      .order("feel_asked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ pending: null });
    }

    const withTrainer = Boolean(
      data.notes && /^With\s+/i.test(String(data.notes))
    );
    const trainerName = withTrainer
      ? String(data.notes).replace(/^With\s+/i, "").trim()
      : null;

    return NextResponse.json({
      pending: {
        rideId: data.id,
        sessionDate: data.session_date,
        horse: data.horse,
        trainerName,
        withTrainer,
        deferrals: data.feel_deferrals ?? 0,
        askedAt: data.feel_asked_at,
      },
    });
  } catch (e) {
    console.error("feel pending", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
