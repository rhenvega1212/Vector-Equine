import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validations/post";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = reportSchema.parse(body);

    // Ensure either post_id or comment_id is provided, but not both
    if (!validatedData.post_id && !validatedData.comment_id) {
      return NextResponse.json(
        { error: "Either post_id or comment_id is required" },
        { status: 400 }
      );
    }

    if (validatedData.post_id && validatedData.comment_id) {
      return NextResponse.json(
        { error: "Cannot report both post and comment" },
        { status: 400 }
      );
    }

    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        reporter_id: user.id,
        post_id: validatedData.post_id || null,
        comment_id: validatedData.comment_id || null,
        reason: validatedData.reason,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
