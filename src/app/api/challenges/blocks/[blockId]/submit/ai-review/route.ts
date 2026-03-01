import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

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

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("id, status, files, notes")
      .eq("block_id", blockId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 400 });
    }

    if (!submission) {
      return NextResponse.json(
        { error: "No submission found for this block" },
        { status: 404 }
      );
    }

    const mockResult = {
      score: Math.floor(Math.random() * 30) + 70,
      feedback: "Great work! Here are some areas for improvement...",
      strengths: ["Clear presentation", "Good technique"],
      improvements: [
        "Could improve pacing",
        "Consider adding more detail",
      ],
      timestamp: new Date().toISOString(),
    };

    const admin = createAdminClient();

    const { data: feedback, error: insertError } = await admin
      .from("ai_submission_feedback")
      .insert({
        submission_id: submission.id,
        result_json: mockResult,
        model: "mock-v1",
        version: 1,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(feedback, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
