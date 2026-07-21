import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { updateTrainingSessionSchema } from "@/lib/validations/training-session";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    // Owner or connected trainer (RLS)
    const { data: session, error } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const body = await request.json();
    const parsed = updateTrainingSessionSchema.parse(body);

    const { data: existing } = await supabase
      .from("training_sessions")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isOwner = existing.user_id === user.id;
    let payload: Record<string, unknown>;

    if (isOwner) {
      payload = { ...parsed };
      delete payload.user_id;
      if (payload.video_link_url === "") payload.video_link_url = null;
    } else {
      // Trainers may only write coaching artifacts
      const coachingOnly = z
        .object({
          summary: z.string().max(10000).optional().nullable(),
          homework: z.string().max(10000).optional().nullable(),
        })
        .strict()
        .parse({
          summary: parsed.summary,
          homework: parsed.homework,
        });
      payload = coachingOnly;
      if (Object.keys(payload).length === 0) {
        return NextResponse.json(
          { error: "Trainers may only update summary and homework" },
          { status: 403 }
        );
      }
    }

    const { data: session, error } = await supabase
      .from("training_sessions")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const { error } = await supabase
      .from("training_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
