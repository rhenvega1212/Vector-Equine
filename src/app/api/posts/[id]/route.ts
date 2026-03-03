import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updatePostSchema } from "@/lib/validations/post";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: post, error } = await supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url),
        post_media (*),
        post_likes (user_id),
        comments (id)
      `)
      .eq("id", id)
      .eq("is_hidden", false)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", id)
      .single() as { data: any };

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.author_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updatePostSchema.parse(body);

    // Update post text and tags
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (validated.content !== undefined) updateData.content = validated.content;
    if (validated.tags !== undefined) updateData.tags = validated.tags;

    const { error: updateError } = await supabase
      .from("posts")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Replace media if a new media array was provided
    if (validated.media !== undefined) {
      // Delete all existing media for this post
      await supabase.from("post_media").delete().eq("post_id", id);

      if (validated.media.length > 0) {
        const mediaInserts = validated.media.map((item, index) => ({
          post_id: id,
          media_type: item.media_type,
          url: item.url,
          thumbnail_url: item.thumbnail_url || null,
          sort_order: index,
        }));

        const { error: mediaError } = await supabase
          .from("post_media")
          .insert(mediaInserts);

        if (mediaError) {
          return NextResponse.json({ error: mediaError.message }, { status: 400 });
        }
      }
    }

    // Return updated post
    const { data: updatedPost } = await supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
        post_media (*),
        post_likes (user_id),
        comments (id),
        challenges (id, title, cover_image_url)
      `)
      .eq("id", id)
      .single();

    return NextResponse.json(updatedPost);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", id)
      .single() as { data: any };

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.author_id !== user.id && profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Not authorized to delete this post" },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("posts").delete().eq("id", id);

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
