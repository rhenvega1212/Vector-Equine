import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCoachCardSummary,
  cleanupTranscriptForJournal,
} from "@/lib/capture/transcript-cleanup";
import { summarizeCaptureTranscript } from "@/lib/capture/summary";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { applyWhisperTranscript } from "@/lib/capture/apply-whisper";
import {
  countVectorLeak,
  fetchTrainerCorpusSegments,
} from "@/lib/capture/trainer-corpus";

export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Background polish after End — cleans ASR + writes the coach-card journal.
 * Safe to call more than once; does not block End.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : null;

    let capture: {
      id: string;
      rider_id: string;
      horse_id: string | null;
      status: string;
      trainer_display_name: string | null;
      training_session_id: string | null;
      t0?: string;
    } | null = null;

    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      if (!claims || claims.captureSessionId !== id) {
        return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
      }
      if (!admin) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
      }
      const { data } = await admin
        .from("capture_sessions")
        .select(
          "id, rider_id, horse_id, status, trainer_display_name, training_session_id, t0"
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
          "id, rider_id, horse_id, status, trainer_display_name, training_session_id, t0"
        )
        .eq("id", id)
        .eq("rider_id", user.id)
        .maybeSingle();
      capture = data;
    }

    if (!capture?.training_session_id) {
      return NextResponse.json({ error: "Lesson not ready to polish" }, { status: 400 });
    }

    const db = admin || (await createClient());

    // Brief 14: corpus chokepoint — never polish on vector speaker rows.
    const corpus = await fetchTrainerCorpusSegments(db, id);
    if (corpus.error) {
      return NextResponse.json({ error: corpus.error }, { status: 400 });
    }
    if (countVectorLeak(corpus.data) > 0) {
      console.error("trainer corpus leaked vector rows", id);
      return NextResponse.json(
        { error: "Corpus chokepoint failed" },
        { status: 500 }
      );
    }

    const browserList = corpus.data.map((s) => ({
      id: s.id,
      speaker: s.speaker,
      text: s.text,
      offset_ms: s.offset_ms,
      raw_json: s.raw_json,
    }));

    // Prefer Whisper over live browser ASR when mic chunks were uploaded
    const { segments: list } = await applyWhisperTranscript({
      captureSessionId: id,
      existing: browserList,
    });

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

    const { cleaned, brief, usedClaude } = await cleanupTranscriptForJournal(
      list,
      {
        horseName,
        horseFocus,
        trainerName: capture.trainer_display_name,
        timeoutMs: 90000,
      }
    );

    // Preserve any rider-highlight block already folded into summary
    const { data: existing } = await db
      .from("training_sessions")
      .select("summary")
      .eq("id", capture.training_session_id)
      .maybeSingle();
    const existingSummary = (existing?.summary as string) || "";
    const markStart = existingSummary.indexOf("<<<rider_highlights>>>");
    const markEnd = existingSummary.indexOf("<<<end_rider_highlights>>>");
    let riderBlock = "";
    if (markStart !== -1 && markEnd !== -1 && markEnd > markStart) {
      riderBlock = existingSummary.slice(
        markStart,
        markEnd + "<<<end_rider_highlights>>>".length
      );
    }

    if (!usedClaude || !brief) {
      // Honest offline fallback — not a fake “important cues” dump
      const fallback = summarizeCaptureTranscript(list, {
        horseFocus,
        trainerName: capture.trainer_display_name,
        horseName,
        startedAt: capture.t0,
      });
      const nextSummary = fallback.focus
        ? `${fallback.focus}\n\n${fallback.summary}`
        : fallback.summary;
      const withMarks = riderBlock
        ? `${nextSummary.trim()}\n\n${riderBlock}`
        : nextSummary;
      await db
        .from("training_sessions")
        .update({
          session_title: fallback.title,
          summary: withMarks,
          homework: fallback.homework || null,
          exercises: fallback.exercises || null,
        })
        .eq("id", capture.training_session_id);
      return NextResponse.json({ polished: false, fallback: true });
    }

    const toPersist = cleaned.filter((s) => s.id && s.raw_json);
    if (toPersist.length > 0) {
      await Promise.all(
        toPersist.map((s) =>
          db
            .from("session_transcript_segments")
            .update({ text: s.text, raw_json: s.raw_json })
            .eq("id", s.id!)
            .eq("capture_session_id", id)
        )
      );
    }

    const cardBody = buildCoachCardSummary({
      focus: brief.focus,
      story: brief.summary,
      corrections: brief.corrections,
      keeps: brief.keeps,
    });
    // focus is already inside cardBody as first paragraph
    const withMarks = riderBlock
      ? `${cardBody.trim()}\n\n${riderBlock}`
      : cardBody;

    await db
      .from("training_sessions")
      .update({
        session_title: brief.title,
        summary: withMarks,
        homework: brief.homework,
        exercises: brief.exercises,
      })
      .eq("id", capture.training_session_id);

    return NextResponse.json({ polished: true });
  } catch (e) {
    console.error("polish error", e);
    return NextResponse.json({ error: "Polish failed" }, { status: 500 });
  }
}
