import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // Check admin (using user's session)
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { role, is_beta_tester } = body;

    if (role && !["rider", "trainer", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const updateData: any = {};
    if (role) {
      updateData.role = role;
      // Reset trainer approval if changing role
      if (role !== "trainer") {
        updateData.trainer_approved = false;
        updateData.trainer_approved_at = null;
      }
    }
    if (typeof is_beta_tester === "boolean") {
      updateData.is_beta_tester = is_beta_tester;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    // Use service role so RLS doesn't block updating another user's profile
    const adminClient = createAdminClient();
    const { data: updatedUser, error } = await adminClient
      .from("profiles")
      .update(updateData)
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
