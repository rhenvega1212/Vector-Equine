import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const segmentSchema = z.object({
  offset_ms: z.number().int().min(0),
  ended_offset_ms: z.number().int().min(0).optional().nullable(),
  speaker: z.enum(["rider", "trainer", "system"]),
  text: z.string().min(1).max(4000),
  confidence: z.number().min(0).max(1).optional().nullable(),
  raw_json: z.record(z.unknown()).optional().nullable(),
});

const batchSchema = z.object({
  segments: z.array(segmentSchema).min(1).max(50),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = batchSchema.parse(body);

    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      if (!claims || claims.captureSessionId !== id) {
        return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
      }
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
      }
      const admin = createAdminClient();
      const { data: capture } = await admin
        .from("capture_sessions")
        .select("id, status")
        .eq("id", id)
        .maybeSingle();
      if (!capture || !["waiting", "live"].includes(capture.status)) {
        return NextResponse.json({ error: "Session not live" }, { status: 400 });
      }

      const rows = parsed.segments.map((s) => ({
        capture_session_id: id,
        offset_ms: s.offset_ms,
        ended_offset_ms: s.ended_offset_ms ?? null,
        speaker: s.speaker === "system" ? "system" : "trainer",
        text: s.text.trim(),
        confidence: s.confidence ?? null,
        raw_json: s.raw_json ?? null,
      }));

      const { data, error } = await admin
        .from("session_transcript_segments")
        .insert(rows)
        .select("id, offset_ms, speaker, text");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ segments: data }, { status: 201 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: capture } = await supabase
      .from("capture_sessions")
      .select("id, status")
      .eq("id", id)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!capture || !["waiting", "live"].includes(capture.status)) {
      return NextResponse.json({ error: "Session not found or not live" }, { status: 400 });
    }

    // Mark live when rider starts speaking/capturing
    if (capture.status === "waiting") {
      await supabase
        .from("capture_sessions")
        .update({ status: "live" })
        .eq("id", id);
    }

    const rows = parsed.segments.map((s) => ({
      capture_session_id: id,
      offset_ms: s.offset_ms,
      ended_offset_ms: s.ended_offset_ms ?? null,
      speaker: s.speaker,
      text: s.text.trim(),
      confidence: s.confidence ?? null,
      raw_json: s.raw_json ?? null,
    }));

    const { data, error } = await supabase
      .from("session_transcript_segments")
      .insert(rows)
      .select("id, offset_ms, speaker, text");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ segments: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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
      .select("id")
      .eq("id", id)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!capture) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("session_transcript_segments")
      .select("id, offset_ms, ended_offset_ms, speaker, text, confidence, created_at")
      .eq("capture_session_id", id)
      .order("offset_ms", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ segments: data || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
