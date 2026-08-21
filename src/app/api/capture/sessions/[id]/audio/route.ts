import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { applyWhisperBytes } from "@/lib/capture/apply-whisper-bytes";
import { isWhisperConfigured } from "@/lib/capture/whisper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_BYTES = 24 * 1024 * 1024;
/** Wait this long for Whisper so the client can paint lines without an extra poll. */
const WHISPER_WAIT_MS = 8_000;

/**
 * Accept a mic chunk, Whisper it, return segments when ready.
 * Storage skipped — bucket create was stalling lab rides.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const admin = createAdminClient();
    let speaker: "rider" | "trainer" = "rider";

    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      if (!claims || claims.captureSessionId !== id) {
        return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
      }
      speaker = "trainer";
      const { data: capture } = await admin
        .from("capture_sessions")
        .select("id, status")
        .eq("id", id)
        .maybeSingle();
      if (!capture || !["waiting", "live", "ended"].includes(capture.status)) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const { data: capture } = await admin
        .from("capture_sessions")
        .select("id, status, rider_id")
        .eq("id", id)
        .maybeSingle();
      if (!capture || capture.rider_id !== user.id) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      if (!["waiting", "live", "ended"].includes(capture.status)) {
        return NextResponse.json({ error: "Session closed" }, { status: 400 });
      }
      speaker = "rider";
    }

    const form = await request.formData();
    const file = form.get("file");
    if (guestToken) speaker = "trainer";
    else speaker = "rider";

    const syncOffsetMs = Math.max(
      0,
      Number.parseInt(String(form.get("sync_offset_ms") || "0"), 10) || 0
    );
    const chunkId = String(form.get("chunk_id") || crypto.randomUUID())
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);

    if (!(file instanceof Blob) || file.size < 64) {
      return NextResponse.json({ error: "Empty audio" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Audio chunk too large (max 24MB)" },
        { status: 413 }
      );
    }

    const mime = file.type || "audio/webm";
    const bytes = new Uint8Array(await file.arrayBuffer());

    let whisperSegs: Array<{
      text: string;
      offset_ms: number;
      ended_offset_ms: number;
    }> = [];

    if (isWhisperConfigured() && bytes.byteLength >= 256) {
      const job = applyWhisperBytes({
        captureSessionId: id,
        audio: bytes,
        speaker,
        syncOffsetMs,
        mediaType: mime,
        windowMs: 10_000,
        chunkPath: `capture-audio/${id}/${speaker}/${syncOffsetMs}-${chunkId}`,
      });

      const finished = await Promise.race([
        job.then((r) => ({ ok: true as const, r })),
        new Promise<{ ok: false }>((resolve) =>
          setTimeout(() => resolve({ ok: false }), WHISPER_WAIT_MS)
        ),
      ]);

      if (finished.ok) {
        whisperSegs = finished.r.segments;
      } else {
        // Still finish in background so poll can pick it up
        void job.catch((e) => console.error("whisper bg", e));
      }
    }

    return NextResponse.json({
      accepted: true,
      speaker,
      sync_offset_ms: syncOffsetMs,
      segments: whisperSegs.map((s) => ({
        offset_ms: s.offset_ms,
        speaker,
        text: s.text,
        ended_offset_ms: s.ended_offset_ms,
      })),
    });
  } catch (e) {
    console.error("capture audio POST", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
