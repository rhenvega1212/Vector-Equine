import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateChallengeSchema } from "@/lib/validations/challenge";
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

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();
    const { data: challenge, error } = await adminClient
      .from("challenges")
      .select(`
        *,
        challenge_modules (
          *,
          challenge_lessons (
            *,
            lesson_content_blocks (*),
            assignments (*)
          )
        )
      `)
      .eq("id", id)
      .single() as { data: any; error: any };

    if (error || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    return NextResponse.json(challenge);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
    const validatedData = updateChallengeSchema.parse(body);

    const adminClient = createAdminClient();
    const { data: existing } = await adminClient
      .from("challenges")
      .select("status, schedule_type")
      .eq("id", id)
      .single() as { data: { status?: string; schedule_type?: string } | null };

    if (existing?.status === "archived") {
      return NextResponse.json(
        { error: "Archived challenges are locked and cannot be updated." },
        { status: 400 }
      );
    }

    const scheduleType = validatedData.schedule_type ?? existing?.schedule_type;
    const payload = {
      ...validatedData,
      open_at: validatedData.open_at !== undefined ? (validatedData.open_at || null) : undefined,
      close_at: validatedData.close_at !== undefined ? (validatedData.close_at || null) : undefined,
      start_at: validatedData.start_at !== undefined ? (validatedData.start_at || null) : undefined,
      end_at: validatedData.end_at !== undefined
        ? (scheduleType === "evergreen" ? null : (validatedData.end_at || null))
        : undefined,
    };

    const { data: challenge, error } = await adminClient
      .from("challenges")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(challenge);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Use admin client for deletion
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("challenges")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
