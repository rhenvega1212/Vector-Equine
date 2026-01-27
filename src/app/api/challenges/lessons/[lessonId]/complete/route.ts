import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Get lesson and check enrollment
    const { data: lesson } = await supabase
      .from("challenge_lessons")
      .select(`
        id,
        requires_submission,
        challenge_modules!inner (
          challenge_id
        )
      `)
      .eq("id", lessonId)
      .single();

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const challengeId = (lesson.challenge_modules as any).challenge_id;

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

    // If lesson requires submission, check if user has submitted
    if (lesson.requires_submission) {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("lesson_id", lessonId)
        .single();

      if (assignment) {
        const { data: submission } = await supabase
          .from("submissions")
          .select("id")
          .eq("assignment_id", assignment.id)
          .eq("user_id", user.id)
          .single();

        if (!submission) {
          return NextResponse.json(
            { error: "Please complete the assignment before marking as done" },
            { status: 400 }
          );
        }
      }
    }

    // Mark lesson as complete (upsert)
    const { error } = await supabase
      .from("lesson_completions")
      .upsert({
        user_id: user.id,
        lesson_id: lessonId,
        completed_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Check if all lessons are complete and update enrollment
    const { data: allLessons } = await supabase
      .from("challenge_lessons")
      .select(`
        id,
        challenge_modules!inner (challenge_id)
      `)
      .eq("challenge_modules.challenge_id", challengeId);

    const lessonIds = allLessons?.map((l) => l.id) || [];

    const { data: completions } = await supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);

    const completedCount = completions?.length || 0;

    if (completedCount === lessonIds.length) {
      // Mark challenge as complete
      await supabase
        .from("challenge_enrollments")
        .update({ completed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
