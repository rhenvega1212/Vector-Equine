import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STAGES = ["off", "internal", "closed_beta", "open_beta", "ga"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
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

    const { data: profile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: { role?: string } | null };
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const update: { stage?: string; rollout_percentage?: number } = {};

    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }
      update.stage = body.stage;
    }

    if (body.rollout_percentage !== undefined) {
      const pct = Number(body.rollout_percentage);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
        return NextResponse.json(
          { error: "rollout_percentage must be an integer 0-100" },
          { status: 400 }
        );
      }
      update.rollout_percentage = pct;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: flag, error } = await admin
      .from("feature_flags")
      .update(update)
      .eq("key", key)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(flag);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
