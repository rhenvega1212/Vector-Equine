import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupTranscriptForJournal } from "@/lib/capture/transcript-cleanup";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Background polish after End — cleans ASR + rewrites journal.
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
          "id, rider_id, horse_id, status, trainer_display_name, training_session_id"
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
          "id, rider_id, horse_id, status, trainer_display_name, training_session_id"
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

    const { cleaned, brief, usedClaude } = await cleanupTranscriptForJournal(
      list,
      {
        horseName,
        horseFocus,
        trainerName: capture.trainer_display_name,
        timeoutMs: 25000,
      }
    );

    if (!usedClaude || !brief) {
      return NextResponse.json({ polished: false });
    }

    const toPersist = cleaned.filter(
      (s) =>
        s.id &&
        s.raw_json &&
        ((s.raw_json as { cleaned?: boolean }).cleaned ||
          (s.raw_json as { featured_quote?: boolean }).featured_quote)
    );
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

    let summary = brief.summary;
    if (brief.quotes?.length && !summary.includes("“")) {
      summary = `${summary}\n\n${brief.quotes
        .map((q) => `“${q.text}”`)
        .join("\n\n")}`;
    }

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

    const nextSummary = brief.focus
      ? `${brief.focus}\n\n${summary}`
      : summary;
    const withMarks = riderBlock
      ? `${nextSummary.trim()}\n\n${riderBlock}`
      : nextSummary;

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
