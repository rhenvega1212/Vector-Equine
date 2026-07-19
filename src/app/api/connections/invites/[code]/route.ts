import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/** Public-ish invite preview for the accept page (works logged out via service role). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;

    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : await createClient();

    const { data: invite, error } = await supabase
      .from("connection_invites")
      .select("id, code, invite_role, status, inviter_id, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status !== "open") {
      return NextResponse.json({ error: "Invite is no longer open" }, { status: 410 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    const { data: inviter } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", invite.inviter_id)
      .maybeSingle();

    return NextResponse.json({
      invite: {
        code: invite.code,
        invite_role: invite.invite_role,
        status: invite.status,
        expires_at: invite.expires_at,
      },
      inviter: inviter
        ? { display_name: inviter.display_name, username: inviter.username }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
