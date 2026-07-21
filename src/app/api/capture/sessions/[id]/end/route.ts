import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeCaptureTranscript } from "@/lib/capture/summary";
import { format } from "date-fns";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: capture } = await supabase
      .from("capture_sessions")
      .select("*")
      .eq("id", id)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!capture) {
      return NextResponse.json({ error: "Capture not found" }, { status: 404 });
    }
    if (capture.status === "ended" && capture.training_session_id) {
      return NextResponse.json({
        training_session_id: capture.training_session_id,
        capture_session_id: capture.id,
      });
    }

    const { data: segments } = await supabase
      .from("session_transcript_segments")
      .select("speaker, text, offset_ms")
      .eq("capture_session_id", id)
      .order("offset_ms", { ascending: true });

    const list = segments || [];

    let horseFocus: string | null = null;
    let horseName = "Horse";
    if (capture.horse_id) {
      const { data: horse } = await supabase
        .from("horse_profiles")
        .select("name, barn_name, current_focus")
        .eq("id", capture.horse_id)
        .eq("user_id", user.id)
        .maybeSingle();
      horseName = horse?.barn_name?.trim() || horse?.name || "Horse";
      horseFocus = horse?.current_focus ?? null;
    }

    const startedAt = new Date(capture.t0);
    const {
      title,
      summary,
      homework,
      exercises,
      focus,
    } = summarizeCaptureTranscript(list, {
      horseFocus,
      trainerName: capture.trainer_display_name,
      horseName,
      startedAt,
    });

    const started = startedAt.getTime();
    const ended = Date.now();
    const durationMinutes = Math.max(
      1,
      Math.round((ended - (Number.isNaN(started) ? ended : started)) / 60000)
    );
    const sessionDate = Number.isNaN(startedAt.getTime())
      ? format(new Date(), "yyyy-MM-dd")
      : format(startedAt, "yyyy-MM-dd");

    // overall_feel is NOT NULL in schema — store neutral mid; UI does not show fake "execution" for comms
    const payload: Record<string, unknown> = {
      user_id: user.id,
      session_date: sessionDate,
      horse: horseName,
      session_type: "lesson",
      overall_feel: 5,
      session_source: "comms",
      session_title: title,
      summary: focus ? `${focus}\n\n${summary}` : summary,
      homework,
      exercises,
      duration_minutes: durationMinutes,
      notes: capture.trainer_display_name
        ? `With ${capture.trainer_display_name}`
        : null,
    };
    if (capture.horse_id) payload.horse_id = capture.horse_id;

    // Prefer user client; fall back to service role if RLS recursion still present
    // until migration fix_training_sessions_rls_recursion is applied.
    let journal: { id: string } | null = null;
    let journalError: { message: string } | null = null;

    const userInsert = await supabase
      .from("training_sessions")
      .insert(payload)
      .select("id")
      .single();

    if (userInsert.error?.message?.includes("infinite recursion")) {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
          {
            error:
              "Could not save journal (RLS). Run supabase/manual/fix_training_sessions_rls_recursion_dev.sql",
          },
          { status: 400 }
        );
      }
      const admin = createAdminClient();
      const adminInsert = await admin
        .from("training_sessions")
        .insert(payload)
        .select("id")
        .single();
      journal = adminInsert.data;
      journalError = adminInsert.error;
    } else {
      journal = userInsert.data;
      journalError = userInsert.error;
    }

    if (journalError || !journal) {
      return NextResponse.json(
        { error: journalError?.message || "Could not create journal entry" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("capture_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        training_session_id: journal.id,
      })
      .eq("id", id)
      .eq("rider_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      training_session_id: journal.id,
      capture_session_id: id,
      summary,
      homework,
      segment_count: list.length,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
