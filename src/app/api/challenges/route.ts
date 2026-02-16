import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: challenges, error } = await supabase
      .from("challenges")
      .select(`
        *,
        profiles!challenges_creator_id_fkey (id, display_name),
        challenge_enrollments (id)
      `)
      .in("status", ["published", "active"])
      .eq("is_private", false)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ challenges });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
