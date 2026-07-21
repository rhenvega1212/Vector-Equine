import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { vectorSetupSchema } from "@/lib/validations/vector-setup";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const flagBlock = await flagGuardForApi("training_diary");
    if (flagBlock) return flagBlock;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role_rider, vector_setup_completed_at")
      .eq("id", user.id)
      .single();

    if (!profile?.role_rider) {
      return NextResponse.json(
        { error: "Vector setup is for riders" },
        { status: 400 }
      );
    }

    if (profile.vector_setup_completed_at) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = vectorSetupSchema.parse(body);
    const now = new Date().toISOString();
    const horse = parsed.horse;

    const { data: createdHorse, error: horseError } = await supabase
      .from("horse_profiles")
      .insert({
        user_id: user.id,
        name: horse.name.trim(),
        breed: horse.breed?.trim() || null,
        age: horse.age != null ? Number(horse.age) : null,
        sex: horse.sex?.trim() || null,
        discipline: horse.discipline.trim(),
        training_level: horse.training_level.trim(),
        goals: horse.goals?.trim() || null,
        injuries_limitations: horse.injuries_limitations?.trim() || null,
        months_together: horse.months_together,
        sessions_per_week: horse.sessions_per_week,
        current_focus: horse.current_focus.trim(),
        sticking_points: horse.sticking_points?.trim() || null,
        health_flags: horse.health_flags ?? [],
        health_flag_notes: horse.health_flag_notes?.trim() || null,
        baseline_completed_at: now,
      })
      .select("id, name")
      .single();

    if (horseError) {
      return NextResponse.json({ error: horseError.message }, { status: 400 });
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        discipline: parsed.discipline,
        rider_level: parsed.rider_level,
        vector_setup_completed_at: now,
      })
      .eq("id", user.id);

    if (profileError) {
      // Roll back horse so the rider can retry cleanly
      if (createdHorse?.id) {
        await supabase.from("horse_profiles").delete().eq("id", createdHorse.id);
      }
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json(
      { horse: createdHorse, vector_setup_completed_at: now },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
