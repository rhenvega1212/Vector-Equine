import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "active", "declined", "removed"]).optional(),
  share_scope: z.enum(["all", "shared_only"]).optional(),
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

    const { data: connections, error } = await supabase
      .from("coach_connections")
      .select(
        `
        *,
        rider:profiles!coach_connections_rider_id_fkey (
          id, username, display_name, avatar_url
        ),
        trainer:profiles!coach_connections_trainer_id_fkey (
          id, username, display_name, avatar_url
        )
      `
      )
      .or(`rider_id.eq.${user.id},trainer_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ connections: connections || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const { data: existing, error: findError } = await supabase
      .from("coach_connections")
      .select("*")
      .eq("id", parsed.id)
      .maybeSingle();

    if (findError || !existing) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    if (existing.rider_id !== user.id && existing.trainer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, string> = {};
    if (parsed.status) updates.status = parsed.status;
    if (parsed.share_scope) {
      if (existing.rider_id !== user.id) {
        return NextResponse.json(
          { error: "Only the rider can change share scope" },
          { status: 403 }
        );
      }
      updates.share_scope = parsed.share_scope;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data: connection, error } = await supabase
      .from("coach_connections")
      .update(updates)
      .eq("id", parsed.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
