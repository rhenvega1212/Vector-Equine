import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if challenge exists, is live (active/published), and not archived
    const { data: challenge } = await supabase
      .from("challenges")
      .select("id, status, schedule_type, open_at, close_at")
      .eq("id", challengeId)
      .single();

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }
    if (challenge.status === "archived") {
      return NextResponse.json(
        { error: "This challenge has ended and is no longer accepting enrollments." },
        { status: 403 }
      );
    }
    if (challenge.status !== "published" && challenge.status !== "active") {
      return NextResponse.json(
        { error: "Challenge not found or not available" },
        { status: 404 }
      );
    }
    // Enrollment window is enforced by RLS (challenge_enrollment_open); optional: check open_at/close_at here for clearer error

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from("challenge_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("challenge_id", challengeId)
      .single();

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "Already enrolled in this challenge" },
        { status: 400 }
      );
    }

    // Create enrollment
    const { data: enrollment, error } = await supabase
      .from("challenge_enrollments")
      .insert({
        user_id: user.id,
        challenge_id: challengeId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
