import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string; postId: string }> }
) {
  try {
    const { postId } = await params;
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

    const { data: existing } = await supabase
      .from("discussion_posts")
      .select("id, user_id")
      .eq("id", postId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only edit your own posts" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.content === "string") {
      updates.content = body.content.trim();
    }

    if (typeof body.is_pinned === "boolean") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        return NextResponse.json(
          { error: "Only admins can pin posts" },
          { status: 403 }
        );
      }
      updates.is_pinned = body.is_pinned;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: post, error } = await supabase
      .from("discussion_posts")
      .update(updates)
      .eq("id", postId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(post);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ blockId: string; postId: string }> }
) {
  try {
    const { postId } = await params;
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

    const { data: existing } = await supabase
      .from("discussion_posts")
      .select("id, user_id")
      .eq("id", postId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const isOwner = existing.user_id === user.id;

    if (!isOwner) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        return NextResponse.json(
          { error: "You can only delete your own posts" },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase
      .from("discussion_posts")
      .delete()
      .eq("id", postId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
