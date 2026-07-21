import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Lightweight poll so both phones learn the lesson ended. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
      const { data } = await admin
        .from("capture_sessions")
        .select("id, status, training_session_id, ended_at")
        .eq("id", id)
        .maybeSingle();
      if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({
        status: data.status,
        training_session_id: data.training_session_id,
        ended_at: data.ended_at,
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data } = await supabase
      .from("capture_sessions")
      .select("id, status, training_session_id, ended_at")
      .eq("id", id)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: data.status,
      training_session_id: data.training_session_id,
      ended_at: data.ended_at,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
