import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: adminProfile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: { role?: string } | null };

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (userId === user.id) {
      return NextResponse.json(
        { error: "You cannot suspend your own account." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to suspend an account." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: target } = (await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()) as { data: { role?: string } | null };

    if (target?.role === "admin") {
      return NextResponse.json(
        { error: "Admins cannot be suspended. Demote them first." },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by: user.id,
        suspension_reason: reason,
      })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Open the appeal thread with the admin's stated reason.
    await adminClient.from("suspension_messages").insert({
      user_id: userId,
      sender_id: user.id,
      sender_role: "admin",
      body: reason,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Lift a suspension (unsuspend).
  try {
    const { id: userId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: adminProfile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: { role?: string } | null };

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim() : "";

    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        is_suspended: false,
        suspended_at: null,
        suspended_by: null,
        suspension_reason: null,
      })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await adminClient.from("suspension_messages").insert({
      user_id: userId,
      sender_id: user.id,
      sender_role: "admin",
      body: note || "Your account has been reinstated. Welcome back.",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
