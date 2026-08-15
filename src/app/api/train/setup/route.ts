import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { z } from "zod";

/** Minimal first-five setup: horse name unlocks the dial. */
const minimalSetupSchema = z.object({
  name: z.string().min(1, "Horse name is required").max(120),
});

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
      .select("role_rider, vector_setup_completed_at, active_horse_id")
      .eq("id", user.id)
      .single();

    if (!profile?.role_rider) {
      return NextResponse.json(
        { error: "Vector setup is for riders" },
        { status: 400 }
      );
    }

    const { count: existingCount } = await supabase
      .from("horse_profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((existingCount ?? 0) > 0) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = minimalSetupSchema.parse(body);
    const now = new Date().toISOString();

    const { data: createdHorse, error: horseError } = await supabase
      .from("horse_profiles")
      .insert({
        user_id: user.id,
        name: parsed.name.trim(),
      })
      .select("id, name")
      .single();

    if (horseError) {
      return NextResponse.json({ error: horseError.message }, { status: 400 });
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        active_horse_id: createdHorse.id,
        vector_setup_completed_at: profile.vector_setup_completed_at ?? now,
      })
      .eq("id", user.id);

    if (profileError) {
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
