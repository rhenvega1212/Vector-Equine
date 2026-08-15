import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateEdgeSession } from "@/lib/capture/edge-auth";
import { buildEdgeManifest } from "@/lib/capture/edge-token";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Jetson signals recording finished for this capture (video uploaded).
 * Does not end the lesson — the rider phone still calls /end.
 * Marks edge_recording false and returns a manifest for labeling.
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
      .select("id, t0, status, edge_device_id, training_session_id")
      .eq("id", id)
      .maybeSingle();

    if (!capture || capture.edge_device_id !== claims.edgeDeviceId) {
      return NextResponse.json({ error: "Session not bound to device" }, { status: 403 });
    }

    await admin
      .from("capture_sessions")
      .update({
        edge_recording: false,
        edge_last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", id);

    const { data: media } = await admin
      .from("session_media_assets")
      .select("kind, storage_path, sync_offset_ms")
      .eq("capture_session_id", id);

    const { count: transcriptCount } = await admin
      .from("session_transcript_segments")
      .select("id", { count: "exact", head: true })
      .eq("capture_session_id", id);

    const files = (media || []).map((m) => ({
      kind: m.kind as string,
      path: (m.storage_path as string) || "",
      sync_offset_ms: (m.sync_offset_ms as number) || 0,
    }));

    const hasVideo = files.some((f) => f.kind === "video");
    const hasSensor = files.some((f) => f.kind === "sensor");

    const manifest = buildEdgeManifest({
      captureSessionId: id,
      t0: capture.t0,
      layers: {
        video: hasVideo,
        sensors: hasSensor,
        transcript: (transcriptCount || 0) > 0,
      },
      files,
    });

    return NextResponse.json({
      ok: true,
      capture_session_id: id,
      training_session_id: capture.training_session_id,
      status: capture.status,
      manifest,
    });
  } catch (e) {
    console.error("edge complete", e);
    return NextResponse.json({ error: "Complete failed" }, { status: 500 });
  }
}
