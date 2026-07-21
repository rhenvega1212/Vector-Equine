import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLiveKitUrl, isLiveKitConfigured, mintLiveKitToken } from "@/lib/capture/livekit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Rider re-fetches LiveKit credentials for an open capture. */
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

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const token = await mintLiveKitToken({
      roomName: capture.livekit_room,
      identity: `rider_${user.id}`,
      name: "Rider",
      canPublish: true,
    });

    return NextResponse.json({
      ...capture,
      join_url: `${origin.replace(/\/$/, "")}/join/${capture.join_code}`,
      livekit: {
        configured: isLiveKitConfigured(),
        url: getLiveKitUrl(),
        token,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
