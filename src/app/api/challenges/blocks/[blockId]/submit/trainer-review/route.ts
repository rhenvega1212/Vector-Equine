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

    const body = await request.json();
    const { trainer_id, price_amount, turnaround_days } = body as {
      trainer_id: string;
      price_amount: number;
      turnaround_days: number;
    };

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("id, status")
      .eq("block_id", blockId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 400 });
    }

    if (!submission) {
      return NextResponse.json(
        { error: "No submission found" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: feedbackRequest, error: insertError } = await admin
      .from("trainer_feedback_requests")
      .insert({
        submission_id: submission.id,
        trainer_id,
        status: "pending",
        price_amount,
        turnaround_days,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    await admin
      .from("submissions")
      .update({ status: "in_review" })
      .eq("id", submission.id);

    return NextResponse.json(feedbackRequest, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
