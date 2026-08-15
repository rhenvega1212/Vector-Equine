import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagGuardForApi } from "@/lib/flags/guards";
import { z } from "zod";

const bodySchema = z.object({
  horseId: z.string().uuid("Invalid horse id"),
});

/** Persist the rider's selected horse for home hero / Live default. */
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

    const parsed = bodySchema.parse(await request.json());

    const { data: horse, error: horseError } = await supabase
      .from("horse_profiles")
      .select("id")
      .eq("id", parsed.horseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (horseError) {
      return NextResponse.json({ error: horseError.message }, { status: 400 });
    }
    if (!horse) {
      return NextResponse.json({ error: "Horse not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ active_horse_id: horse.id })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ active_horse_id: horse.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
