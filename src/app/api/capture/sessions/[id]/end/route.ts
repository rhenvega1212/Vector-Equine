import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pendingCaptureBrief } from "@/lib/capture/summary";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { readCleanedTranscript } from "@/lib/capture/transcript-read";
import { calendarDateInHomeTz } from "@/lib/timezone";

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
  is_test?: boolean | null;
};

type DbClient = ReturnType<typeof createAdminClient>;

/**
 * End lesson for everyone — rider (cookie) or trainer (guest Bearer).
 * Fast path: mark ended + thin pending journal stub. Claude polish is kicked off
 * by the client afterward so End never freezes.
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
          "id, rider_id, horse_id, status, t0, trainer_display_name, training_session_id, is_test"
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
          "id, rider_id, horse_id, status, t0, trainer_display_name, training_session_id, is_test"
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
        polish: true,
      });
    }

    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : null;
    const db = (admin || (await createClient())) as DbClient;

    // Close live session first so peers stop reconnecting immediately
    if (capture.status !== "ended") {
      const { error: closeErr } = await db
        .from("capture_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (closeErr) {
        return NextResponse.json({ error: closeErr.message }, { status: 400 });
      }
    }

    // Feeds the journal summary a rider reads, so: cleaned, and no vector rows.
    const transcript = await readCleanedTranscript(db, id, {
      includeVector: false,
    });
    const list = transcript.data.map((s) => ({
      id: s.id,
      speaker: s.speaker,
      text: s.text,
      offset_ms: s.offset_ms,
      raw_json: s.raw_json,
    }));

    const { data: videoAsset } = await db
      .from("session_media_assets")
      .select("id")
      .eq("capture_session_id", id)
      .eq("kind", "video")
      .limit(1)
      .maybeSingle();
    const sessionSource = videoAsset ? "hybrid" : "comms";

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

    const startedAt = new Date(capture.t0);
    // A lab test, or a capture that recorded nothing, is not a lesson.
    const isTestRide = Boolean(capture.is_test) || list.length === 0;
    const stub = pendingCaptureBrief({
      horseFocus,
      horseName,
      startedAt,
      hasSpeech: list.length > 0,
      isTest: isTestRide,
    });

    const started = startedAt.getTime();
    const endedMs = Date.now();
    const durationMinutes = Math.max(
      1,
      Math.round((endedMs - (Number.isNaN(started) ? endedMs : started)) / 60000)
    );
    const sessionDate = Number.isNaN(startedAt.getTime())
      ? calendarDateInHomeTz()
      : calendarDateInHomeTz(startedAt);

    const askedAt = new Date().toISOString();
    const payload: Record<string, unknown> = {
      user_id: capture.rider_id,
      session_date: sessionDate,
      horse: horseName,
      session_type: "lesson",
      // Brief 14: unanswered feel is null forever — never fabricate a 5.
      overall_feel: null,
      feel_scale: null,
      feel_asked_at: askedAt,
      feel_answered_at: null,
      feel_deferrals: 0,
      is_test: Boolean(capture.is_test),
      session_source: sessionSource,
      session_title: stub.title,
      summary: stub.focus
        ? `${stub.focus}\n\n${stub.summary}`
        : stub.summary,
      homework: stub.homework || null,
      exercises: stub.exercises || null,
      duration_minutes: durationMinutes,
      notes: capture.trainer_display_name
        ? `With ${capture.trainer_display_name}`
        : null,
    };
    if (capture.horse_id) payload.horse_id = capture.horse_id;

    // A second End (retry, double tap, or Lab clearing a leftover) must not
    // write another ride — re-read the link after the slow work above.
    const { data: linkCheck } = await db
      .from("capture_sessions")
      .select("training_session_id")
      .eq("id", id)
      .maybeSingle();
    const alreadyLinked = (
      linkCheck as { training_session_id?: string | null } | null
    )?.training_session_id;
    if (alreadyLinked) {
      return NextResponse.json({
        training_session_id: alreadyLinked,
        capture_session_id: capture.id,
        already_ended: true,
        polish: true,
      });
    }

    let journal: { id: string } | null = null;
    let journalError: { message: string } | null = null;

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

    if (journalError?.message && /is_test/i.test(journalError.message)) {
      delete payload.is_test;
      if (asGuest || admin) {
        const writer = admin || db;
        const retry = await writer
          .from("training_sessions")
          .insert(payload)
          .select("id")
          .single();
        journal = retry.data;
        journalError = retry.error;
      } else {
        const supabase = await createClient();
        const retry = await supabase
          .from("training_sessions")
          .insert(payload)
          .select("id")
          .single();
        journal = retry.data;
        journalError = retry.error;
      }
    }

    if (journalError?.message && /feel_/i.test(journalError.message)) {
      delete payload.feel_scale;
      delete payload.feel_asked_at;
      delete payload.feel_answered_at;
      delete payload.feel_deferrals;
      if (asGuest || admin) {
        const writer = admin || db;
        const retry = await writer
          .from("training_sessions")
          .insert(payload)
          .select("id")
          .single();
        journal = retry.data;
        journalError = retry.error;
      } else {
        const supabase = await createClient();
        const retry = await supabase
          .from("training_sessions")
          .insert(payload)
          .select("id")
          .single();
        journal = retry.data;
        journalError = retry.error;
      }
    }

    if (journalError || !journal) {
      // Capture is already ended — still let the phones leave (don't 400-trap them)
      console.error("end lesson journal", journalError);
      return NextResponse.json({
        training_session_id: null,
        capture_session_id: id,
        capture_ended: true,
        polish: false,
        brief_pending: false,
        ended_by: asGuest ? "trainer" : "rider",
        warning: journalError?.message || "Journal stub failed",
      });
    }

    await db
      .from("capture_sessions")
      .update({ training_session_id: journal.id })
      .eq("id", id);

    return NextResponse.json({
      training_session_id: journal.id,
      capture_session_id: id,
      summary: stub.summary,
      homework: stub.homework,
      segment_count: list.length,
      cleaned: false,
      polish: true,
      brief_pending: true,
      ended_by: asGuest ? "trainer" : "rider",
    });
  } catch (e) {
    console.error("end lesson error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
