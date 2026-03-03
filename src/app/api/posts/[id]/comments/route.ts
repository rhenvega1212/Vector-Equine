import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveUserId } from "@/lib/admin/impersonate";
import { createCommentSchema } from "@/lib/validations/post";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();

    // Try with comment_media join, fall back to basic select if table doesn't exist yet
    let { data: comments, error } = await supabase
      .from("comments")
      .select(COMMENT_SELECT_FULL)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error?.message?.includes("comment_media")) {
      const result = await supabase
        .from("comments")
        .select(COMMENT_SELECT_BASIC)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      comments = (result.data || []).map((c: any) => ({ ...c, comment_media: [] }));
      error = result.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!user || !effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    const { data: post } = await supabase
      .from("posts")
      .select("id, author_id")
      .eq("id", postId)
      .eq("is_hidden", false)
      .single() as { data: any };

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    let parentCommentAuthorId: string | null = null;
    if (validatedData.parent_id) {
      const { data: parentComment } = await supabase
        .from("comments")
        .select("id, post_id, author_id")
        .eq("id", validatedData.parent_id)
        .eq("post_id", postId)
        .single() as { data: any };

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
      parentCommentAuthorId = parentComment.author_id;
    }

    // If reply_to_id is set, verify it exists and belongs to the same post
    let replyToAuthorId: string | null = null;
    if (validatedData.reply_to_id) {
      const { data: replyToComment } = await supabase
        .from("comments")
        .select("id, post_id, author_id")
        .eq("id", validatedData.reply_to_id)
        .eq("post_id", postId)
        .single() as { data: any };

      if (replyToComment) {
        replyToAuthorId = replyToComment.author_id;
      }
    }

    const writeClient = effectiveUserId !== user.id ? createAdminClient() : supabase;

    const insertData: Record<string, unknown> = {
      post_id: postId,
      author_id: effectiveUserId,
      content: validatedData.content || "",
      parent_id: validatedData.parent_id || null,
    };

    // reply_to_id may not exist in DB yet if migration hasn't run
    if (validatedData.reply_to_id) {
      insertData.reply_to_id = validatedData.reply_to_id;
    }

    const { data: comment, error } = await writeClient
      .from("comments")
      .insert(insertData)
      .select(COMMENT_SELECT_BASIC)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Insert comment media if present (table may not exist yet)
    if (validatedData.media && validatedData.media.length > 0) {
      const mediaInserts = validatedData.media.map((item, index) => ({
        comment_id: comment.id,
        media_type: item.media_type,
        url: item.url,
        sort_order: index,
      }));

      const { error: mediaError } = await writeClient
        .from("comment_media")
        .insert(mediaInserts);

      if (mediaError && !mediaError.message?.includes("comment_media")) {
        await writeClient.from("comments").delete().eq("id", comment.id);
        return NextResponse.json({ error: mediaError.message }, { status: 400 });
      }
    }

    // Notifications: notify the person being replied to, or the post author
    const notifyUserId = replyToAuthorId || parentCommentAuthorId;
    if (notifyUserId && notifyUserId !== effectiveUserId) {
      await writeClient.from("notifications").insert({
        user_id: notifyUserId,
        type: "reply",
        actor_id: effectiveUserId,
        post_id: postId,
        comment_id: comment.id,
      });
    } else if (post.author_id !== effectiveUserId) {
      await writeClient.from("notifications").insert({
        user_id: post.author_id,
        type: "comment",
        actor_id: effectiveUserId,
        post_id: postId,
        comment_id: comment.id,
      });
    }

    // Re-fetch with media included (if table exists)
    const { data: fullComment } = await supabase
      .from("comments")
      .select(COMMENT_SELECT_FULL)
      .eq("id", comment.id)
      .single();

    const result = fullComment || { ...comment, comment_media: [] };
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
