import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateEdgeSession } from "@/lib/capture/edge-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Jetson heartbeat — keeps edge_recording alive and reports layer status. */
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

    const body = await request.json().catch(() => ({}));
    const recording = body.recording !== false;
    const layers = body.layers || {};

    const admin = createAdminClient();
    const { data: capture } = await admin
      .from("capture_sessions")
      .select("id, status, t0, edge_device_id")
      .eq("id", id)
      .maybeSingle();

    if (!capture || capture.edge_device_id !== claims.edgeDeviceId) {
      return NextResponse.json({ error: "Session not bound to device" }, { status: 403 });
    }

    await admin
      .from("capture_sessions")
      .update({
        edge_recording: recording,
        edge_last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", id);

    await admin
      .from("edge_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", claims.edgeDeviceId);

    return NextResponse.json({
      ok: true,
      capture_session_id: id,
      t0: capture.t0,
      status: capture.status,
      edge_recording: recording,
      layers: {
        video: !!layers.video,
        sensors: !!layers.sensors,
        transcript: layers.transcript !== false,
      },
    });
  } catch (e) {
    console.error("edge heartbeat", e);
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
