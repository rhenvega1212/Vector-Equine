import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/vector/invites";
import { z } from "zod";

const createInviteSchema = z.object({
  invite_role: z.enum(["rider", "trainer"]),
  email: z.string().email().optional().nullable(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: invites, error } = await supabase
      .from("connection_invites")
      .select("*")
      .eq("inviter_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ invites: invites || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createInviteSchema.parse(body);

    let code = generateInviteCode();
    let invite = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from("connection_invites")
        .insert({
          inviter_id: user.id,
          invite_role: parsed.invite_role,
          code,
          email: parsed.email || null,
          status: "open",
        })
        .select()
        .single();

      if (!error && data) {
        invite = data;
        break;
      }
      lastError = error?.message ?? "Failed to create invite";
      code = generateInviteCode();
    }

    if (!invite) {
      return NextResponse.json({ error: lastError || "Failed to create invite" }, { status: 400 });
    }

    return NextResponse.json({ invite, url: `/invite/${invite.code}` }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
