import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSubmissionSchema } from "@/lib/validations/challenge";
import { z } from "zod";

const submitSchema = createSubmissionSchema.extend({
  assignment_id: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = submitSchema.parse(body);

    // Get assignment and verify it belongs to the lesson
    const { data: assignment } = await supabase
      .from("assignments")
      .select(`
        id,
        lesson_id,
        challenge_lessons!inner (
          challenge_modules!inner (
            challenge_id
          )
        )
      `)
      .eq("id", validatedData.assignment_id)
      .eq("lesson_id", lessonId)
      .single();

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const challengeId =
      (assignment as any).challenge_lessons.challenge_modules.challenge_id;

    // Check enrollment
    const { data: enrollment } = await supabase
      .from("challenge_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("challenge_id", challengeId)
      .single();

    if (!enrollment) {
      return NextResponse.json(
        { error: "Not enrolled in this challenge" },
        { status: 403 }
      );
    }

    // Check for existing submission
    const { data: existingSubmission } = await supabase
      .from("submissions")
      .select("id")
      .eq("assignment_id", validatedData.assignment_id)
      .eq("user_id", user.id)
      .single();

    let submission;

    if (existingSubmission) {
      // Update existing submission
      const { data, error } = await supabase
        .from("submissions")
        .update({
          content: validatedData.content || null,
          media_url: validatedData.media_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSubmission.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      submission = data;
    } else {
      // Create new submission
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          assignment_id: validatedData.assignment_id,
          user_id: user.id,
          content: validatedData.content || null,
          media_url: validatedData.media_url || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      submission = data;
    }

    return NextResponse.json(submission, { status: existingSubmission ? 200 : 201 });
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
