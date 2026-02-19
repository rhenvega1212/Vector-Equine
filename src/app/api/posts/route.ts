import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/admin/impersonate";
import { createPostSchema } from "@/lib/validations/post";
import { z } from "zod";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitExceededResponse,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const effectiveUserId = await getEffectiveUserId(request);

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "feed";
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Feed shows all posts (room for future algorithm: sort by score, boost, etc.)
    let query = supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
        post_media (*),
        post_likes (user_id),
        comments (id)
      `)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type === "following" && effectiveUserId) {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", effectiveUserId);

      const followingIds = following?.map((f) => f.following_id) || [];
      if (followingIds.length > 0) {
        query = query.in("author_id", [...followingIds, effectiveUserId]);
      } else {
        query = query.eq("author_id", effectiveUserId);
      }
    }

    const { data: posts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // For "Suggested" labels: return ids of authors the effective user follows (and self)
    let followingAuthorIds: string[] = [];
    if (effectiveUserId) {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", effectiveUserId);
      followingAuthorIds = [
        effectiveUserId,
        ...(following?.map((f) => f.following_id) || []),
      ];
    }

    return NextResponse.json({ posts, following_author_ids: followingAuthorIds });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 posts per minute per user
  const clientId = getClientIdentifier(request);
  const rateCheck = checkRateLimit(`post:${clientId}`, RATE_LIMITS.write);
  
  if (!rateCheck.success) {
    return rateLimitExceededResponse(rateCheck);
  }

  try {
    const supabase = await createClient();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createPostSchema.parse(body);

    // Create post (as effective user when admin is impersonating)
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        author_id: effectiveUserId,
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
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
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
