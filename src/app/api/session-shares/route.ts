import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createSchema = z.object({
  session_id: z.string().uuid(),
  trainer_id: z.string().uuid(),
});

/** List shared_only coaches for a session the rider owns, with share status. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    const { data: session } = await supabase
      .from("training_sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: connections, error: connError } = await supabase
      .from("coach_connections")
      .select("trainer_id, share_scope, status")
      .eq("rider_id", user.id)
      .eq("status", "active")
      .eq("share_scope", "shared_only");

    if (connError) {
      return NextResponse.json({ error: connError.message }, { status: 400 });
    }

    if (!connections?.length) {
      return NextResponse.json({ coaches: [] });
    }

    const trainerIds = connections.map((c) => c.trainer_id);

    const [{ data: profiles }, { data: shares }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", trainerIds),
      supabase
        .from("session_shares")
        .select("id, trainer_id")
        .eq("session_id", sessionId)
        .in("trainer_id", trainerIds),
    ]);

    const shareByTrainer = new Map(
      (shares || []).map((s) => [s.trainer_id, s.id] as const)
    );
    const nameById = new Map(
      (profiles || []).map((p) => [
        p.id,
        p.display_name || p.username || "Coach",
      ] as const)
    );

    const coaches = trainerIds.map((trainer_id) => ({
      trainer_id,
      display_name: nameById.get(trainer_id) || "Coach",
      share_id: shareByTrainer.get(trainer_id) ?? null,
    }));

    return NextResponse.json({ coaches });
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

    const body = await request.json();
    const parsed = createSchema.parse(body);

    const { data: session } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("id", parsed.session_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: connection } = await supabase
      .from("coach_connections")
      .select("id")
      .eq("rider_id", user.id)
      .eq("trainer_id", parsed.trainer_id)
      .eq("status", "active")
      .maybeSingle();

    if (!connection) {
      return NextResponse.json(
        { error: "No active connection with this coach" },
        { status: 400 }
      );
    }

    const { data: share, error } = await supabase
      .from("session_shares")
      .upsert(
        {
          session_id: parsed.session_id,
          trainer_id: parsed.trainer_id,
        },
        { onConflict: "session_id,trainer_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // RLS: riders manage shares of own sessions
    const { error } = await supabase.from("session_shares").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
