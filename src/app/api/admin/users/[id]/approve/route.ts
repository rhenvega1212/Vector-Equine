import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { approved } = body;

    // Check target user is a trainer
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single() as { data: any };

    if (targetUser?.role !== "trainer") {
      return NextResponse.json(
        { error: "User is not a trainer" },
        { status: 400 }
      );
    }

    const { data: updatedUser, error } = await supabase
      .from("profiles")
      .update({
        trainer_approved: approved,
        trainer_approved_at: approved ? new Date().toISOString() : null,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
