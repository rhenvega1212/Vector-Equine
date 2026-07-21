import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateParticipantId,
  signGuestCaptureToken,
} from "@/lib/capture/guest-token";
import { getLiveKitUrl, isLiveKitConfigured, mintLiveKitToken } from "@/lib/capture/livekit";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ code: string }>;
}

const joinBodySchema = z.object({
  display_name: z.string().min(1).max(80),
});

/** Preview a join code (public). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Join unavailable — service role not configured" },
        { status: 503 }
      );
    }

    const { code } = await params;
    const supabase = createAdminClient();
    const { data: capture } = await supabase
      .from("capture_sessions")
      .select(
        "id, join_code, status, expires_at, horse_id, rider_id, trainer_display_name"
      )
      .eq("join_code", code.toUpperCase())
      .maybeSingle();

    if (!capture) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (capture.status === "ended") {
      return NextResponse.json({ error: "This lesson has ended" }, { status: 410 });
    }

    if (new Date(capture.expires_at) < new Date()) {
      return NextResponse.json({ error: "Join code expired" }, { status: 410 });
    }

    const { data: rider } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", capture.rider_id)
      .maybeSingle();

    let horseName: string | null = null;
    if (capture.horse_id) {
      const { data: horse } = await supabase
        .from("horse_profiles")
        .select("name, barn_name")
        .eq("id", capture.horse_id)
        .maybeSingle();
      horseName = horse?.barn_name?.trim() || horse?.name || null;
    }

    return NextResponse.json({
      join_code: capture.join_code,
      status: capture.status,
      rider_name: rider?.display_name || "Rider",
      horse_name: horseName,
      trainer_display_name: capture.trainer_display_name,
      livekit_configured: isLiveKitConfigured(),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Guest trainer joins (no account) — issues LiveKit + guest segment token. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Join unavailable — service role not configured" },
        { status: 503 }
      );
    }

    const { code } = await params;
    const body = joinBodySchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: capture } = await supabase
      .from("capture_sessions")
      .select("*")
      .eq("join_code", code.toUpperCase())
      .maybeSingle();

    if (!capture) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }
    if (capture.status === "ended") {
      return NextResponse.json({ error: "This lesson has ended" }, { status: 410 });
    }
    if (new Date(capture.expires_at) < new Date()) {
      return NextResponse.json({ error: "Join code expired" }, { status: 410 });
    }

    const participantId = capture.trainer_participant_id || generateParticipantId();
    const now = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("capture_sessions")
      .update({
        status: "live",
        trainer_display_name: body.display_name.trim(),
        trainer_participant_id: participantId,
        updated_at: now,
      })
      .eq("id", capture.id)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || "Join failed" }, { status: 400 });
    }

    const { data: rider } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", updated.rider_id)
      .maybeSingle();

    let horseName: string | null = null;
    if (updated.horse_id) {
      const { data: horse } = await supabase
        .from("horse_profiles")
        .select("name, barn_name")
        .eq("id", updated.horse_id)
        .maybeSingle();
      horseName = horse?.barn_name?.trim() || horse?.name || null;
    }

    const livekitToken = await mintLiveKitToken({
      roomName: updated.livekit_room,
      identity: `trainer_${participantId}`,
      name: body.display_name.trim(),
      canPublish: true,
    });

    const guestToken = signGuestCaptureToken({
      captureSessionId: updated.id,
      participantId,
    });

    return NextResponse.json({
      capture_session_id: updated.id,
      t0: updated.t0,
      rider_name: rider?.display_name || "Rider",
      horse_name: horseName,
      trainer_display_name: updated.trainer_display_name,
      guest_token: guestToken,
      livekit: {
        configured: isLiveKitConfigured(),
        url: getLiveKitUrl(),
        token: livekitToken,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
