import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateEdgeDevice } from "@/lib/capture/edge-auth";
import { buildEdgeManifest, signEdgeSessionToken } from "@/lib/capture/edge-token";

/**
 * Jetson attaches to the rider's open capture session.
 * Auth: Authorization: Edge <device_key>:<device_secret>
 *
 * Returns capture_session_id, t0 (master clock), and a short-lived session token
 * for heartbeat / video upload.
 */
export async function POST(request: NextRequest) {
  try {
    const device = await authenticateEdgeDevice(
      request.headers.get("authorization")
    );
    if (!device) {
      return NextResponse.json({ error: "Invalid edge credentials" }, { status: 401 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const admin = createAdminClient();
    const { data: capture, error } = await admin
      .from("capture_sessions")
      .select(
        "id, t0, status, horse_id, training_session_id, edge_device_id, edge_recording"
      )
      .eq("rider_id", device.rider_id)
      .in("status", ["waiting", "live"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("edge attach", error);
      return NextResponse.json(
        {
          error: error.message.includes("edge_device")
            ? "Apply migration 20260804000000_edge_devices.sql first"
            : error.message,
        },
        { status: 400 }
      );
    }

    if (!capture) {
      return NextResponse.json(
        {
          error: "No open lesson",
          hint: "Rider must Start on the phone first, then the Jetson attaches.",
        },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const { error: bindErr } = await admin
      .from("capture_sessions")
      .update({
        edge_device_id: device.id,
        edge_recording: true,
        edge_last_heartbeat_at: now,
        // Keep waiting until trainer joins; edge can still record
        status: capture.status === "waiting" ? "waiting" : capture.status,
      })
      .eq("id", capture.id);

    if (bindErr) {
      console.error("edge bind", bindErr);
      return NextResponse.json({ error: bindErr.message }, { status: 400 });
    }

    const sessionToken = signEdgeSessionToken({
      captureSessionId: capture.id,
      edgeDeviceId: device.id,
    });

    const manifest = buildEdgeManifest({
      captureSessionId: capture.id,
      t0: capture.t0,
      layers: { video: true, sensors: false, transcript: true },
    });

    return NextResponse.json({
      capture_session_id: capture.id,
      t0: capture.t0,
      status: capture.status,
      horse_id: capture.horse_id,
      training_session_id: capture.training_session_id,
      edge_device_id: device.id,
      session_token: sessionToken,
      manifest,
      clock: {
        owner: "platform",
        field: "capture_sessions.t0",
        stamp: "offset_ms from t0 on every sample/frame",
      },
    });
  } catch (e) {
    console.error("edge attach", e);
    return NextResponse.json({ error: "Attach failed" }, { status: 500 });
  }
}
