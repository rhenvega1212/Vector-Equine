import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCommentSchema } from "@/lib/validations/post";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = await createClient();

    const { data: comments, error } = await supabase
      .from("comments")
      .select(`
        *,
        profiles!comments_author_id_fkey (id, username, display_name, avatar_url, role)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

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

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    // Verify post exists and is not hidden, get author for notification
    const { data: post } = await supabase
      .from("posts")
      .select("id, author_id")
      .eq("id", postId)
      .eq("is_hidden", false)
      .single() as { data: any };

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // If replying, verify parent comment exists and belongs to same post
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

    const { data: comment, error } = await (supabase as any)
      .from("comments")
      .insert({
        post_id: postId,
        author_id: user.id,
        content: validatedData.content,
        parent_id: validatedData.parent_id || null,
      })
      .select(`
        *,
        profiles!comments_author_id_fkey (id, username, display_name, avatar_url, role)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create notification
    if (validatedData.parent_id && parentCommentAuthorId && parentCommentAuthorId !== user.id) {
      // Reply notification to parent comment author
      await (supabase as any)
        .from("notifications")
        .insert({
          user_id: parentCommentAuthorId,
          type: "reply",
          actor_id: user.id,
          post_id: postId,
          comment_id: comment.id,
        });
    } else if (post.author_id !== user.id) {
      // Comment notification to post author
      await (supabase as any)
        .from("notifications")
        .insert({
          user_id: post.author_id,
          type: "comment",
          actor_id: user.id,
          post_id: postId,
          comment_id: comment.id,
        });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return first error message as a string instead of array of objects
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
