import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveUserId } from "@/lib/admin/impersonate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: followingId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!user || !effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Can't follow yourself
    if (effectiveUserId === followingId) {
      return NextResponse.json(
        { error: "You cannot follow yourself" },
        { status: 400 }
      );
    }

    // Check if target user exists
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", followingId)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // When impersonating, RLS requires auth.uid() = follower_id; use admin client to write as effective user
    const writeClient = effectiveUserId !== user.id ? createAdminClient() : supabase;

    // Create follow relationship (uses effective user when admin is impersonating)
    const { error } = await writeClient
      .from("follows")
      .insert({
        follower_id: effectiveUserId,
        following_id: followingId,
      });

    if (error) {
      // Handle duplicate follow
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Already following this user" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Create notification for the followed user
    await writeClient
      .from("notifications")
      .insert({
        user_id: followingId,
        type: "follow",
        actor_id: effectiveUserId,
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: followingId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!user || !effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const writeClient = effectiveUserId !== user.id ? createAdminClient() : supabase;
    const { error } = await writeClient
      .from("follows")
      .delete()
      .eq("follower_id", effectiveUserId)
      .eq("following_id", followingId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
