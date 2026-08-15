import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { createHorseProfileSchema } from "@/lib/validations/horse-profile";
import { z } from "zod";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const { data: horses, error } = await supabase
      .from("horse_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ horses: horses || [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const body = await request.json();
    const parsed = createHorseProfileSchema.parse(body);

    const payload = {
      user_id: user.id,
      name: parsed.name.trim(),
      barn_name: parsed.barn_name?.trim() || null,
      breed: parsed.breed?.trim() || null,
      age: parsed.age != null ? Number(parsed.age) : null,
      birthday: parsed.birthday || null,
      sex: parsed.sex?.trim() || null,
      height: parsed.height?.trim() || null,
      color: parsed.color?.trim() || null,
      discipline: parsed.discipline?.trim() || null,
      training_level: parsed.training_level?.trim() || null,
      owner: parsed.owner?.trim() || null,
      rider: parsed.rider?.trim() || null,
      trainer: parsed.trainer?.trim() || null,
      purchase_lease_status: parsed.purchase_lease_status?.trim() || null,
      date_acquired: parsed.date_acquired || null,
      notes: parsed.notes?.trim() || null,
      profile_photo_url: parsed.profile_photo_url || null,
      show_name: parsed.show_name?.trim() || null,
      personality_quirks: parsed.personality_quirks?.trim() || null,
      injuries_limitations: parsed.injuries_limitations?.trim() || null,
      goals: parsed.goals?.trim() || null,
    };

    const { data: horse, error } = await supabase
      .from("horse_profiles")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Unlock dial + set home horse when this is the rider's first (or no active yet).
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("active_horse_id, vector_setup_completed_at")
      .eq("id", user.id)
      .maybeSingle();

    const profilePatch: {
      active_horse_id?: string;
      vector_setup_completed_at?: string;
    } = {};
    if (!profileRow?.active_horse_id) {
      profilePatch.active_horse_id = horse.id;
    }
    if (!profileRow?.vector_setup_completed_at) {
      profilePatch.vector_setup_completed_at = new Date().toISOString();
    }
    if (Object.keys(profilePatch).length > 0) {
      await supabase.from("profiles").update(profilePatch).eq("id", user.id);
    }

    return NextResponse.json(horse, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
