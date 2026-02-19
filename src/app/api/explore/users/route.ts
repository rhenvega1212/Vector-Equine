import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() || "";
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "20", 10),
      50
    );

    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const searchPattern = `%${q}%`;
    let query = supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, discipline, rider_level")
      .or(`username.ilike.${searchPattern},display_name.ilike.${searchPattern}`)
      .limit(limit);

    const { data: users, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ users: users ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
