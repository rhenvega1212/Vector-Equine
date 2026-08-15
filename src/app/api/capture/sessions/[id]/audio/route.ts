import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { applyWhisperChunk } from "@/lib/capture/apply-whisper-chunk";
import { isWhisperConfigured } from "@/lib/capture/whisper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const BUCKET = "session-videos";
const MAX_BYTES = 24 * 1024 * 1024; // Whisper limit is 25MB

/**
 * Upload a lesson mic chunk for Whisper re-transcription on polish.
 * Form fields: file, speaker (rider|trainer), sync_offset_ms, chunk_id
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
    const formSpeaker = String(form.get("speaker") || speaker);
    if (formSpeaker === "rider" || formSpeaker === "trainer") {
      // Guests are always trainer; riders always rider — ignore spoof from peer role
      if (guestToken) speaker = "trainer";
      else speaker = "rider";
    }

    const syncOffsetMs = Math.max(
      0,
      Number.parseInt(String(form.get("sync_offset_ms") || "0"), 10) || 0
    );
    const chunkId = String(form.get("chunk_id") || crypto.randomUUID()).replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    ).slice(0, 80);

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
    const ext = mime.includes("mp4") || mime.includes("m4a") ? "mp4" : "webm";
    const path = `capture-audio/${id}/${speaker}/${syncOffsetMs}-${chunkId}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: mime,
        upsert: true,
      });

    if (upErr) {
      console.error("capture audio upload", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // Idempotent: one row per storage path
    const { data: existing } = await admin
      .from("session_media_assets")
      .select("id")
      .eq("capture_session_id", id)
      .eq("storage_path", path)
      .maybeSingle();

    let assetId = existing?.id as string | undefined;
    if (!assetId) {
      const { data: inserted, error: insErr } = await admin
        .from("session_media_assets")
        .insert({
          capture_session_id: id,
          kind: "audio_recording",
          storage_path: path,
          sync_offset_ms: syncOffsetMs,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("capture audio asset insert", insErr);
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
      assetId = inserted.id;
    }

    // Correct the live timeline with Whisper after this chunk lands
    if (isWhisperConfigured()) {
      waitUntil(
        applyWhisperChunk({
          captureSessionId: id,
          storagePath: path,
          speaker,
          syncOffsetMs,
          windowMs: 50_000,
        }).catch((e) => console.error("whisper chunk after", e))
      );
    }

    return NextResponse.json({
      id: assetId,
      storage_path: path,
      speaker,
      sync_offset_ms: syncOffsetMs,
    });
  } catch (e) {
    console.error("capture audio POST", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
