import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: invite, error: inviteError } = await supabase
      .from("connection_invites")
      .select("*")
      .eq("code", code)
      .eq("status", "open")
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found or no longer open" }, { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabase
        .from("connection_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    if (invite.inviter_id === user.id) {
      return NextResponse.json({ error: "You cannot accept your own invite" }, { status: 400 });
    }

    // invite_role = role the recipient takes
    const riderId = invite.invite_role === "rider" ? user.id : invite.inviter_id;
    const trainerId = invite.invite_role === "trainer" ? user.id : invite.inviter_id;
    const initiatedBy = invite.invite_role === "trainer" ? "rider" : "trainer";

    const { data: existing } = await supabase
      .from("coach_connections")
      .select("*")
      .eq("rider_id", riderId)
      .eq("trainer_id", trainerId)
      .maybeSingle();

    let connection;
    if (existing) {
      const { data, error } = await supabase
        .from("coach_connections")
        .update({ status: "active" })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      connection = data;
    } else {
      const { data, error } = await supabase
        .from("coach_connections")
        .insert({
          rider_id: riderId,
          trainer_id: trainerId,
          status: "active",
          initiated_by: initiatedBy,
          share_scope: "shared_only",
        })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      connection = data;
    }

    // Ensure recipient has the corresponding role flag
    const rolePatch =
      invite.invite_role === "trainer"
        ? { role_trainer: true }
        : { role_rider: true };
    await supabase.from("profiles").update(rolePatch).eq("id", user.id);

    await supabase
      .from("connection_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    return NextResponse.json({ connection });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
