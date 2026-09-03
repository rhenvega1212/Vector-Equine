import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VECTOR_CONFIG } from "@/lib/vector/config";
import { readRawTranscript } from "@/lib/capture/transcript-read";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Lab JSONL-ready export for builders. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!VECTOR_CONFIG.CAPTURE_LAB) {
      return NextResponse.json({ error: "Lab disabled" }, { status: 403 });
    }

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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Raw by design: this is the artifact a reference transcript gets
    // hand-corrected against, so it carries verbatim text and every flagged
    // row, with the rule that flagged it.
    const transcript = await readRawTranscript(supabase, id);
    const segments = transcript.data.map((s) => {
      const raw = (s.raw_json || {}) as Record<string, unknown>;
      return {
        offset_ms: s.offset_ms,
        ended_offset_ms: s.ended_offset_ms,
        speaker: s.speaker,
        text: s.text,
        confidence: s.confidence,
        flag_reason: s.flag_reason,
        engine: raw.engine ?? null,
        model: raw.model ?? null,
        quality: raw.quality ?? null,
      };
    });

    const { data: media } = await supabase
      .from("session_media_assets")
      .select("kind, storage_path, sync_offset_ms")
      .eq("capture_session_id", id);

    const payload = {
      capture_session_id: capture.id,
      training_session_id: capture.training_session_id,
      horse_id: capture.horse_id,
      t0: capture.t0,
      ended_at: capture.ended_at,
      trainer_display_name: capture.trainer_display_name,
      transcript_variant: transcript.variant,
      segments,
      media: media || [],
      sensors: [] as unknown[],
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="capture-${id}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
