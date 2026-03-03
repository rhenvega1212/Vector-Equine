import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateCommentSchema } from "@/lib/validations/post";
import { z } from "zod";

const COMMENT_SELECT_FULL = `
  *,
  profiles!comments_author_id_fkey (id, username, display_name, avatar_url, role),
  comment_media (*)
`;

const COMMENT_SELECT_BASIC = `
  *,
  profiles!comments_author_id_fkey (id, username, display_name, avatar_url, role)
`;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: comment } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", commentId)
      .single() as { data: any };

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (comment.author_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateCommentSchema.parse(body);

    if (validated.content !== undefined) {
      const { error: updateError } = await supabase
        .from("comments")
        .update({ content: validated.content, updated_at: new Date().toISOString() })
        .eq("id", commentId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    // Replace comment media if provided
    if (validated.media !== undefined) {
      await supabase.from("comment_media").delete().eq("comment_id", commentId).catch(() => {});

      if (validated.media.length > 0) {
        const mediaInserts = validated.media.map((item, index) => ({
          comment_id: commentId,
          media_type: item.media_type,
          url: item.url,
          sort_order: index,
        }));

        await supabase.from("comment_media").insert(mediaInserts).catch(() => {});
      }
    }

    // Re-fetch
    let { data: updated } = await supabase
      .from("comments")
      .select(COMMENT_SELECT_FULL)
      .eq("id", commentId)
      .single();

    if (!updated) {
      const result = await supabase
        .from("comments")
        .select(COMMENT_SELECT_BASIC)
        .eq("id", commentId)
        .single();
      updated = result.data ? { ...result.data, comment_media: [] } : null;
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    const { data: comment } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", commentId)
      .single() as { data: any };

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.author_id !== user.id && profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Not authorized to delete this comment" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
