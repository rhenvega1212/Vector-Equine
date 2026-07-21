import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeCaptureTranscript } from "@/lib/capture/summary";
import { cleanupTranscriptForJournal } from "@/lib/capture/transcript-cleanup";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { format } from "date-fns";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type CaptureRow = {
  id: string;
  rider_id: string;
  horse_id: string | null;
  status: string;
  t0: string;
  trainer_display_name: string | null;
  training_session_id: string | null;
};

/**
 * End lesson for everyone — rider (cookie) or trainer (guest Bearer).
 * Marks capture ended, builds journal, peers discover via LiveKit + status poll.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let capture: CaptureRow | null = null;
    let asGuest = false;

    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      if (!claims || claims.captureSessionId !== id) {
        return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
      }
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
      }
      asGuest = true;
      const admin = createAdminClient();
      const { data } = await admin
        .from("capture_sessions")
        .select(
          "id, rider_id, horse_id, status, t0, trainer_display_name, training_session_id"
        )
        .eq("id", id)
        .maybeSingle();
      capture = data;
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const { data } = await supabase
        .from("capture_sessions")
        .select(
          "id, rider_id, horse_id, status, t0, trainer_display_name, training_session_id"
        )
        .eq("id", id)
        .eq("rider_id", user.id)
        .maybeSingle();
      capture = data;
    }

    if (!capture) {
      return NextResponse.json({ error: "Capture not found" }, { status: 404 });
    }

    if (capture.status === "ended" && capture.training_session_id) {
      return NextResponse.json({
        training_session_id: capture.training_session_id,
        capture_session_id: capture.id,
        already_ended: true,
      });
    }

    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : null;
    const db = admin || (await createClient());

    const { data: segments } = await db
      .from("session_transcript_segments")
      .select("id, speaker, text, offset_ms, raw_json")
      .eq("capture_session_id", id)
      .order("offset_ms", { ascending: true });

    const list = (segments || []).map((s) => ({
      id: s.id as string,
      speaker: s.speaker as string,
      text: s.text as string,
      offset_ms: s.offset_ms as number,
      raw_json: (s.raw_json as Record<string, unknown> | null) || null,
    }));

    let horseFocus: string | null = null;
    let horseName = "Horse";
    if (capture.horse_id) {
      const { data: horse } = await db
        .from("horse_profiles")
        .select("name, barn_name, current_focus")
        .eq("id", capture.horse_id)
        .maybeSingle();
      horseName = horse?.barn_name?.trim() || horse?.name || "Horse";
      horseFocus = horse?.current_focus ?? null;
    }

    const { cleaned, brief: claudeBrief, usedClaude } =
      await cleanupTranscriptForJournal(list, {
        horseName,
        horseFocus,
        trainerName: capture.trainer_display_name,
      });

    const toPersist = cleaned.filter(
      (s) =>
        s.id &&
        s.raw_json &&
        ((s.raw_json as { cleaned?: boolean }).cleaned ||
          (s.raw_json as { featured_quote?: boolean }).featured_quote)
    );
    if (usedClaude && toPersist.length > 0) {
      await Promise.all(
        toPersist.map((s) =>
          db
            .from("session_transcript_segments")
            .update({
              text: s.text,
              raw_json: s.raw_json,
            })
            .eq("id", s.id!)
            .eq("capture_session_id", id)
        )
      );
    }

    const startedAt = new Date(capture.t0);
    const heuristic = summarizeCaptureTranscript(cleaned, {
      horseFocus,
      trainerName: capture.trainer_display_name,
      horseName,
      startedAt,
    });

    const title = claudeBrief?.title || heuristic.title;
    const focus = claudeBrief?.focus || heuristic.focus;
    let summary = claudeBrief?.summary || heuristic.summary;
    const homework = claudeBrief?.homework || heuristic.homework;
    const exercises = claudeBrief?.exercises || heuristic.exercises;

    if (claudeBrief?.quotes?.length) {
      const quoteBlock = claudeBrief.quotes
        .map((q) => `“${q.text}”`)
        .join("\n\n");
      if (!summary.includes("“")) {
        summary = `${summary}\n\n${quoteBlock}`;
      }
    }

    const started = startedAt.getTime();
    const ended = Date.now();
    const durationMinutes = Math.max(
      1,
      Math.round((ended - (Number.isNaN(started) ? ended : started)) / 60000)
    );
    const sessionDate = Number.isNaN(startedAt.getTime())
      ? format(new Date(), "yyyy-MM-dd")
      : format(startedAt, "yyyy-MM-dd");

    const payload: Record<string, unknown> = {
      user_id: capture.rider_id,
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

    let journal: { id: string } | null = null;
    let journalError: { message: string } | null = null;

    // Guest end always uses admin; rider prefers user client then admin fallback
    if (asGuest || admin) {
      const writer = admin || db;
      const insert = await writer
        .from("training_sessions")
        .insert(payload)
        .select("id")
        .single();
      journal = insert.data;
      journalError = insert.error;
    } else {
      const supabase = await createClient();
      const userInsert = await supabase
        .from("training_sessions")
        .insert(payload)
        .select("id")
        .single();
      if (userInsert.error?.message?.includes("infinite recursion")) {
        return NextResponse.json(
          {
            error:
              "Could not save journal (RLS). Run supabase/manual/fix_training_sessions_rls_recursion_dev.sql",
          },
          { status: 400 }
        );
      }
      journal = userInsert.data;
      journalError = userInsert.error;
    }

    if (journalError || !journal) {
      return NextResponse.json(
        { error: journalError?.message || "Could not create journal entry" },
        { status: 400 }
      );
    }

    const { error: updateError } = await db
      .from("capture_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        training_session_id: journal.id,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      training_session_id: journal.id,
      capture_session_id: id,
      summary,
      homework,
      segment_count: list.length,
      cleaned: usedClaude,
      ended_by: asGuest ? "trainer" : "rider",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
