import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: submission, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("block_id", blockId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!submission) {
      return NextResponse.json({
        submission: null,
        aiFeedback: [],
        trainerFeedback: [],
      });
    }

    const admin = createAdminClient();

    const [aiRes, trainerRes] = await Promise.all([
      admin
        .from("ai_submission_feedback")
        .select("*")
        .eq("submission_id", submission.id)
        .order("created_at", { ascending: false }),
      admin
        .from("trainer_feedback_requests")
        .select("*")
        .eq("submission_id", submission.id)
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      submission,
      aiFeedback: aiRes.data ?? [],
      trainerFeedback: trainerRes.data ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { files, notes } = body as {
      files: { url: string; name: string; type: string }[];
      notes?: string;
    };

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("submissions")
      .select("id")
      .eq("block_id", blockId)
      .eq("user_id", user.id)
      .maybeSingle();

    let submission;

    if (existing) {
      const { data, error } = await supabase
        .from("submissions")
        .update({
          files: JSON.stringify(files),
          notes: notes ?? null,
          status: "submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      submission = data;
    } else {
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          block_id: blockId,
          user_id: user.id,
          files: JSON.stringify(files),
          notes: notes ?? null,
          status: "submitted",
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      submission = data;
    }

    return NextResponse.json(submission, {
      status: existing ? 200 : 201,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
