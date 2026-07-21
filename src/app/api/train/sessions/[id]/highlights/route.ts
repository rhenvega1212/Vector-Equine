import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeRiderHighlightsIntoSummary } from "@/lib/capture/transcript-cleanup";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const toggleSchema = z.object({
  segment_id: z.string().uuid(),
  highlighted: z.boolean(),
});

/**
 * Toggle rider highlight on a transcript segment, then fold all highlights into the journal summary.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const body = toggleSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: session } = await supabase
      .from("training_sessions")
      .select("id, user_id, summary, notes")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: capture } = await supabase
      .from("capture_sessions")
      .select("id, trainer_display_name")
      .eq("training_session_id", sessionId)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!capture) {
      return NextResponse.json({ error: "No capture for this session" }, { status: 400 });
    }

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : supabase;

    const { data: segment } = await db
      .from("session_transcript_segments")
      .select("id, offset_ms, speaker, text, raw_json")
      .eq("id", body.segment_id)
      .eq("capture_session_id", capture.id)
      .maybeSingle();

    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    const prev =
      segment.raw_json && typeof segment.raw_json === "object"
        ? (segment.raw_json as Record<string, unknown>)
        : {};
    const nextRaw = {
      ...prev,
      rider_highlight: body.highlighted,
    };

    const { error: updErr } = await db
      .from("session_transcript_segments")
      .update({ raw_json: nextRaw })
      .eq("id", segment.id)
      .eq("capture_session_id", capture.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    const { data: allSegs } = await db
      .from("session_transcript_segments")
      .select("id, offset_ms, speaker, text, raw_json")
      .eq("capture_session_id", capture.id)
      .order("offset_ms", { ascending: true });

    const highlighted = (allSegs || []).filter((s) => {
      const raw = s.raw_json as Record<string, unknown> | null;
      return !!raw?.rider_highlight;
    });

    const trainerName =
      capture.trainer_display_name ||
      (typeof session.notes === "string" && /^With\s+/i.test(session.notes)
        ? session.notes.replace(/^With\s+/i, "").trim()
        : null);

    const newSummary = mergeRiderHighlightsIntoSummary(
      session.summary,
      highlighted.map((s) => ({
        offset_ms: s.offset_ms,
        speaker: s.speaker,
        text: s.text,
        trainerName,
      }))
    );

    const { error: sumErr } = await supabase
      .from("training_sessions")
      .update({ summary: newSummary || null })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (sumErr && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await createAdminClient()
        .from("training_sessions")
        .update({ summary: newSummary || null })
        .eq("id", sessionId);
    } else if (sumErr) {
      return NextResponse.json({ error: sumErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      highlighted: body.highlighted,
      segment_id: body.segment_id,
      highlight_count: highlighted.length,
      summary: newSummary,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
