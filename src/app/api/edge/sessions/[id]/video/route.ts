import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateEdgeSession } from "@/lib/capture/edge-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const BUCKET = "session-videos";
/** Soft limit for direct multipart (prefer chunked/sign for long rides). */
const MAX_BYTES = 95 * 1024 * 1024;

/**
 * Upload lesson video from the Jetson.
 * Auth: Bearer <edge session_token> from /api/edge/sessions/attach
 *
 * multipart: file, sync_offset_ms (default 0), chunk_id (optional)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const claims = authenticateEdgeSession(request.headers.get("authorization"));
    if (!claims || claims.captureSessionId !== id) {
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const admin = createAdminClient();
    const { data: capture } = await admin
      .from("capture_sessions")
      .select("id, status, edge_device_id, t0")
      .eq("id", id)
      .maybeSingle();

    if (!capture || capture.edge_device_id !== claims.edgeDeviceId) {
      return NextResponse.json({ error: "Session not bound to device" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const syncOffsetMs = Math.max(
      0,
      Number.parseInt(String(form.get("sync_offset_ms") || "0"), 10) || 0
    );
    const chunkId = String(form.get("chunk_id") || "main")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);

    if (!(file instanceof Blob) || file.size < 64) {
      return NextResponse.json({ error: "Empty video" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: "Video too large for direct upload (max ~95MB). Split chunks or use signed upload.",
        },
        { status: 413 }
      );
    }

    const mime = file.type || "video/mp4";
    const ext = mime.includes("webm")
      ? "webm"
      : mime.includes("quicktime") || mime.includes("mov")
        ? "mov"
        : "mp4";
    const path = `capture-video/${id}/${syncOffsetMs}-${chunkId}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (upErr) {
      console.error("edge video upload", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

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
          kind: "video",
          storage_path: path,
          sync_offset_ms: syncOffsetMs,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("edge video asset", insErr);
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
      assetId = inserted.id;
    } else {
      await admin
        .from("session_media_assets")
        .update({ sync_offset_ms: syncOffsetMs })
        .eq("id", assetId);
    }

    await admin
      .from("capture_sessions")
      .update({ edge_last_heartbeat_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      id: assetId,
      storage_path: path,
      kind: "video",
      sync_offset_ms: syncOffsetMs,
      t0: capture.t0,
      bytes: file.size,
    });
  } catch (e) {
    console.error("edge video POST", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
