import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { isFlagEnabled } from "@/lib/flags/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("answer"),
    value: z.number().int().min(1).max(5),
  }),
  z.object({
    action: z.literal("defer"),
  }),
]);

/**
 * Answer or defer a feel. Scale is stamped only with value (same transaction).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, profile } = await getCurrentProfile();
    if (!user || !profile) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const enabled = await isFlagEnabled("vector_feel_prompt", profile);
    if (!enabled) {
      return NextResponse.json({ error: "Not available" }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: row, error: loadErr } = await supabase
      .from("training_sessions")
      .select("id, overall_feel, feel_deferrals, feel_asked_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (loadErr || !row) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }

    if (row.overall_feel != null) {
      return NextResponse.json({ ok: true, already: true });
    }

    if (parsed.data.action === "defer") {
      // Push ask window out so the rider isn't yanked back immediately
      const later = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("training_sessions")
        .update({
          feel_deferrals: (row.feel_deferrals ?? 0) + 1,
          feel_asked_at: later,
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, deferred: true });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("training_sessions")
      .update({
        overall_feel: parsed.data.value,
        feel_scale: 5,
        feel_answered_at: now,
        feel_asked_at: row.feel_asked_at ?? now,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("overall_feel", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, value: parsed.data.value, scale: 5 });
  } catch (e) {
    console.error("feel answer", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
