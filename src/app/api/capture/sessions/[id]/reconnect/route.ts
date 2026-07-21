import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import {
  getLiveKitUrl,
  isLiveKitConfigured,
  mintLiveKitToken,
} from "@/lib/capture/livekit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Mint a fresh LiveKit token for an in-progress capture.
 * Rider: session cookie. Trainer: Bearer guest token.
 * Does NOT end or recreate the capture — reconnect only.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isLiveKitConfigured()) {
      return NextResponse.json(
        { error: "LiveKit is not configured" },
        { status: 503 }
      );
    }

    const auth = request.headers.get("authorization");
    const guestToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      if (!claims || claims.captureSessionId !== id) {
        return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
      }
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Unavailable" }, { status: 503 });
      }
      const supabase = createAdminClient();
      const { data: capture } = await supabase
        .from("capture_sessions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!capture || capture.status === "ended") {
        return NextResponse.json({ error: "Session ended" }, { status: 410 });
      }

      const token = await mintLiveKitToken({
        roomName: capture.livekit_room,
        identity: `trainer_${claims.participantId}`,
        name: capture.trainer_display_name || "Trainer",
        canPublish: true,
      });

      return NextResponse.json({
        livekit: {
          configured: true,
          url: getLiveKitUrl(),
          token,
        },
      });
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
      .select("*")
      .eq("id", id)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!capture) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (capture.status === "ended") {
      return NextResponse.json({ error: "Session ended" }, { status: 410 });
    }

    const token = await mintLiveKitToken({
      roomName: capture.livekit_room,
      identity: `rider_${user.id}`,
      name: "Rider",
      canPublish: true,
    });

    return NextResponse.json({
      livekit: {
        configured: true,
        url: getLiveKitUrl(),
        token,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
