import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/admin/impersonate";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "12", 10),
      24
    );

    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", effectiveUserId);
    const followingIds = new Set(
      following?.map((f) => f.following_id) ?? []
    );
    followingIds.add(effectiveUserId);

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, discipline, rider_level")
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const discover = (profiles ?? []).filter((p) => !followingIds.has(p.id));
    const sliced = discover.slice(0, limit);

    return NextResponse.json({ users: sliced });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
