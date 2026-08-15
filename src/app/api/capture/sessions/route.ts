import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { generateJoinCode } from "@/lib/capture/guest-token";
import { getLiveKitUrl, isLiveKitConfigured, mintLiveKitToken } from "@/lib/capture/livekit";
import { VECTOR_CONFIG } from "@/lib/vector/config";
import { z } from "zod";

const startSchema = z.object({
  horse_id: z.string().uuid().optional().nullable(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const { data, error } = await supabase
      .from("capture_sessions")
      .select(
        "id, horse_id, training_session_id, join_code, status, t0, started_at, ended_at, trainer_display_name"
      )
      .eq("rider_id", user.id)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ captures: data || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    if (VECTOR_CONFIG.CAPTURE_REQUIRE_LIVEKIT && !isLiveKitConfigured()) {
      return NextResponse.json(
        { error: "LiveKit is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = startSchema.parse(body);

    if (parsed.horse_id) {
      const { data: horse } = await supabase
        .from("horse_profiles")
        .select("id")
        .eq("id", parsed.horse_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!horse) {
        return NextResponse.json({ error: "Horse not found" }, { status: 404 });
      }
    }

    // Resume an open lesson instead of killing it (phone lock / remount / refresh)
    const { data: existing } = await supabase
      .from("capture_sessions")
      .select("*")
      .eq("rider_id", user.id)
      .in("status", ["waiting", "live"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const origin =
        request.headers.get("origin") ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000";
      const joinUrl = `${origin.replace(/\/$/, "")}/join/${existing.join_code}`;
      const token = await mintLiveKitToken({
        roomName: existing.livekit_room,
        identity: `rider_${user.id}`,
        name: "Rider",
        canPublish: true,
      });
      return NextResponse.json({
        ...existing,
        join_url: joinUrl,
        resumed: true,
        edge: {
          attach: "/api/edge/sessions/attach",
          note: "Jetson: attach after Start to share this session t0",
        },
        livekit: {
          configured: isLiveKitConfigured(),
          url: getLiveKitUrl(),
          token,
        },
      });
    }

    let joinCode = generateJoinCode(6).toUpperCase();
    for (let attempt = 0; attempt < 5; attempt++) {
      const roomName = `capture_${user.id.slice(0, 8)}_${Date.now()}`;
      const { data: created, error } = await supabase
        .from("capture_sessions")
        .insert({
          rider_id: user.id,
          horse_id: parsed.horse_id || null,
          join_code: joinCode,
          livekit_room: roomName,
          status: "waiting",
        })
        .select("*")
        .single();

      if (!error && created) {
        const origin =
          request.headers.get("origin") ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000";
        const joinUrl = `${origin.replace(/\/$/, "")}/join/${created.join_code}`;

        const token = await mintLiveKitToken({
          roomName: created.livekit_room,
          identity: `rider_${user.id}`,
          name: "Rider",
          canPublish: true,
        });

        return NextResponse.json(
          {
            ...created,
            join_url: joinUrl,
            edge: {
              attach: "/api/edge/sessions/attach",
              note: "Jetson: attach after Start to share this session t0",
            },
            livekit: {
              configured: isLiveKitConfigured(),
              url: getLiveKitUrl(),
              token,
            },
          },
          { status: 201 }
        );
      }

      if (error?.code === "23505") {
        joinCode = generateJoinCode(6).toUpperCase();
        continue;
      }
      return NextResponse.json({ error: error?.message || "Create failed" }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not allocate join code" }, { status: 500 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
