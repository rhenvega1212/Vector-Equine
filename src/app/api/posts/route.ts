import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPostSchema } from "@/lib/validations/post";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "explore";
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "10");

    let query = supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url),
        post_media (*),
        post_likes (user_id),
        comments (id)
      `)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type === "following" && user) {
      // Get list of users the current user follows
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = following?.map((f) => f.following_id) || [];
      
      // Include user's own posts and posts from followed users
      if (followingIds.length > 0) {
        query = query.in("author_id", [...followingIds, user.id]);
      } else {
        query = query.eq("author_id", user.id);
      }
    }

    const { data: posts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createPostSchema.parse(body);

    // Create post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        content: validatedData.content,
        tags: validatedData.tags || [],
      })
      .select()
      .single();

    if (postError) {
      return NextResponse.json({ error: postError.message }, { status: 400 });
    }

    // Add media if present
    if (validatedData.media && validatedData.media.length > 0) {
      const mediaInserts = validatedData.media.map((item, index) => ({
        post_id: post.id,
        media_type: item.media_type,
        url: item.url,
        thumbnail_url: item.thumbnail_url || null,
        sort_order: index,
      }));

      const { error: mediaError } = await supabase
        .from("post_media")
        .insert(mediaInserts);

      if (mediaError) {
        // Rollback post creation
        await supabase.from("posts").delete().eq("id", post.id);
        return NextResponse.json({ error: mediaError.message }, { status: 400 });
      }
    }

    // Fetch complete post with relations
    const { data: completePost } = await supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url),
        post_media (*),
        post_likes (user_id),
        comments (id)
      `)
      .eq("id", post.id)
      .single();

    return NextResponse.json(completePost, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
