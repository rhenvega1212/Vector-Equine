import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { updateHorseProfileSchema } from "@/lib/validations/horse-profile";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
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

    const { data: horse, error } = await supabase
      .from("horse_profiles")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !horse) {
      return NextResponse.json({ error: "Horse not found" }, { status: 404 });
    }

    return NextResponse.json(horse);
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
    const parsed = updateHorseProfileSchema.parse(body);

    const payload: Record<string, unknown> = {};
    const allowed = [
      "name", "barn_name", "breed", "age", "birthday", "sex", "height", "color",
      "discipline", "training_level", "owner", "rider", "trainer", "purchase_lease_status",
      "date_acquired", "notes", "profile_photo_url", "show_name", "personality_quirks",
      "injuries_limitations", "goals",
    ];
    for (const key of allowed) {
      const v = (parsed as Record<string, unknown>)[key];
      if (v !== undefined) {
        payload[key] = typeof v === "string" ? (v.trim() || null) : v;
      }
    }

    const { data: horse, error } = await supabase
      .from("horse_profiles")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(horse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
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
      .from("horse_profiles")
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
