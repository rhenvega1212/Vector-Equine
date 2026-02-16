import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createChallengeSchema } from "@/lib/validations/challenge";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Use admin client to bypass RLS and fetch ALL challenges
    const adminClient = createAdminClient();
    const { data: challenges, error } = await adminClient
      .from("challenges")
      .select(`
        *,
        challenge_enrollments (id)
      `)
      .order("created_at", { ascending: false }) as { data: any[]; error: any };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Add enrollment count
    const enrichedChallenges = challenges.map((challenge: any) => ({
      ...challenge,
      enrollment_count: challenge.challenge_enrollments.length,
      challenge_enrollments: undefined,
    }));

    return NextResponse.json({ challenges: enrichedChallenges });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createChallengeSchema.parse(body);

    const scheduleType = validatedData.schedule_type ?? "scheduled";
    const payload = {
      ...validatedData,
      open_at: validatedData.open_at || null,
      close_at: validatedData.close_at || null,
      start_at: validatedData.start_at || null,
      end_at: scheduleType === "evergreen" ? null : (validatedData.end_at || null),
    };

    const adminClient = createAdminClient();
    const { data: challenge, error } = await adminClient
      .from("challenges")
      .insert({
        creator_id: user.id,
        ...payload,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(challenge, { status: 201 });
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
