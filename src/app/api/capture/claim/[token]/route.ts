import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { upsertCaptureCoachConnection } from "@/lib/capture/claim";
import { parseCoachCardSummary } from "@/lib/capture/transcript-cleanup";

interface RouteParams {
  params: Promise<{ token: string }>;
}

async function loadCaptureByClaimToken(token: string) {
  const admin = createAdminClient();
  const { data: capture } = await admin
    .from("capture_sessions")
    .select(
      "id, rider_id, horse_id, training_session_id, trainer_id, claim_token, claim_expires_at, claimed_at, started_at, ended_at, status, trainer_display_name"
    )
    .eq("claim_token", token)
    .maybeSingle();
  return { admin, capture };
}

/** Public teaser for an unclaimed guest lesson — never the full debrief. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Claim unavailable — service role not configured" },
        { status: 503 }
      );
    }

    const { token } = await params;
    if (!token?.trim()) {
      return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });
    }

    const { admin, capture } = await loadCaptureByClaimToken(token.trim());
    if (!capture) {
      return NextResponse.json({ valid: false, error: "Lesson not found" }, { status: 404 });
    }

    const expired =
      !!capture.claim_expires_at &&
      new Date(capture.claim_expires_at).getTime() < Date.now();
    const alreadyClaimed = !!capture.claimed_at || !!capture.trainer_id;
    const valid = !expired && !alreadyClaimed;

    const { data: rider } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", capture.rider_id)
      .maybeSingle();

    let horseName: string | null = null;
    if (capture.horse_id) {
      const { data: horse } = await admin
        .from("horse_profiles")
        .select("name, barn_name")
        .eq("id", capture.horse_id)
        .maybeSingle();
      horseName = horse?.barn_name?.trim() || horse?.name || null;
    }

    let lessonDate: string | null = capture.started_at || null;
    let durationMinutes: number | null = null;
    let focus: string | null = null;
    let correctionCount: number | null = null;
    let pending = true;

    if (capture.training_session_id) {
      const { data: session } = await admin
        .from("training_sessions")
        .select("session_date, duration_minutes, summary")
        .eq("id", capture.training_session_id)
        .maybeSingle();

      if (session) {
        lessonDate = session.session_date || lessonDate;
        durationMinutes =
          typeof session.duration_minutes === "number"
            ? session.duration_minutes
            : null;

        const card = parseCoachCardSummary(session.summary);
        if (card.pending || !session.summary?.trim()) {
          pending = true;
          focus = null;
          correctionCount = null;
        } else {
          pending = false;
          focus = card.focus;
          correctionCount = card.corrections.length;
        }
      }
    } else if (capture.ended_at && capture.started_at) {
      const ms =
        new Date(capture.ended_at).getTime() -
        new Date(capture.started_at).getTime();
      if (ms > 0) durationMinutes = Math.round(ms / 60000);
    }

    return NextResponse.json({
      valid,
      expired,
      claimed: alreadyClaimed,
      pending,
      rider_name: rider?.display_name || "Rider",
      horse_name: horseName,
      lesson_date: lessonDate,
      duration_minutes: durationMinutes,
      // Teaser only — never story, homework, or transcript.
      focus: pending || !valid ? null : focus,
      correction_count: pending || !valid ? null : correctionCount,
      trainer_display_name: capture.trainer_display_name,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Authenticated coach claims the lesson they taught. */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Claim unavailable — service role not configured" },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { token } = await params;
    if (!token?.trim()) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const { admin, capture } = await loadCaptureByClaimToken(token.trim());
    if (!capture) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (capture.trainer_id && capture.trainer_id !== user.id) {
      return NextResponse.json({ error: "This lesson was already claimed" }, { status: 409 });
    }

    if (
      capture.claim_expires_at &&
      new Date(capture.claim_expires_at).getTime() < Date.now() &&
      !capture.trainer_id
    ) {
      return NextResponse.json({ error: "Claim link expired" }, { status: 410 });
    }

    if (capture.rider_id === user.id) {
      return NextResponse.json(
        { error: "You cannot claim your own lesson as coach" },
        { status: 400 }
      );
    }

    // Idempotent: already claimed by this user (e.g. signed-in join).
    if (capture.trainer_id === user.id && capture.claimed_at) {
      const connection = await upsertCaptureCoachConnection(admin, {
        riderId: capture.rider_id,
        trainerId: user.id,
      });
      return NextResponse.json({
        sessionId: capture.training_session_id,
        connectionId: connection?.id ?? null,
      });
    }

    const now = new Date().toISOString();

    const { error: captureErr } = await admin
      .from("capture_sessions")
      .update({
        trainer_id: user.id,
        claimed_at: now,
        updated_at: now,
      })
      .eq("id", capture.id)
      .is("claimed_at", null);

    if (captureErr) {
      return NextResponse.json({ error: captureErr.message }, { status: 400 });
    }

    // Ensure coach seat — no payment / roster checks.
    await admin
      .from("profiles")
      .update({ role_trainer: true })
      .eq("id", user.id);

    if (capture.training_session_id) {
      await admin
        .from("training_sessions")
        .update({ trainer_id: user.id, updated_at: now })
        .eq("id", capture.training_session_id);
    }

    const connection = await upsertCaptureCoachConnection(admin, {
      riderId: capture.rider_id,
      trainerId: user.id,
    });

    if (!capture.training_session_id) {
      return NextResponse.json(
        {
          sessionId: null,
          connectionId: connection?.id ?? null,
          warning: "Lesson write-up is still linking — claim saved",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      sessionId: capture.training_session_id,
      connectionId: connection?.id ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
