import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { challenge_id, ordered_ids } = await request.json();
    if (!challenge_id || !Array.isArray(ordered_ids)) {
      return NextResponse.json({ error: "challenge_id and ordered_ids required" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const updates = ordered_ids.map((id: string, index: number) =>
      adminClient
        .from("challenge_modules")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("challenge_id", challenge_id)
    );

    await Promise.all(updates);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
