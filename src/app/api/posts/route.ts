import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const blockId = searchParams.get("block_id");
    const challengeId = searchParams.get("challenge_id");
    const sortBy = searchParams.get("sort") || "newest";

    const selectFields = `
      *,
      profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
      post_media (*),
      post_likes (user_id),
      comments (id),
      challenges (id, title, cover_image_url)
    `;

    // Discussion block query: return all posts for a specific block
    if (blockId) {
      let blockQuery = supabase
        .from("posts")
        .select(selectFields)
        .eq("is_hidden", false)
        .eq("block_id", blockId);

      if (sortBy === "top") {
        blockQuery = blockQuery.order("created_at", { ascending: false });
      } else {
        blockQuery = blockQuery.order("created_at", { ascending: false });
      }

      blockQuery = blockQuery.range(offset, offset + limit - 1);
      const { data: blockPosts, error: blockError } = await blockQuery;

      if (blockError) {
        return NextResponse.json({ error: blockError.message }, { status: 400 });
      }

      // For "top" sort, re-sort by likes count client-side
      const sorted = sortBy === "top"
        ? (blockPosts ?? []).sort((a: any, b: any) =>
            (b.post_likes?.length ?? 0) - (a.post_likes?.length ?? 0)
          )
        : blockPosts;

      return NextResponse.json({
        posts: sorted,
        following_author_ids: effectiveUserId ? [effectiveUserId] : [],
      });
    }

    // Challenge activity query: all posts for a challenge
    if (challengeId) {
      const challengeQuery = supabase
        .from("posts")
        .select(selectFields)
        .eq("is_hidden", false)
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: challengePosts, error: challengeError } = await challengeQuery;

      if (challengeError) {
        return NextResponse.json({ error: challengeError.message }, { status: 400 });
      }

      return NextResponse.json({
        posts: challengePosts,
        following_author_ids: effectiveUserId ? [effectiveUserId] : [],
      });
    }

    // Standard feed query: exclude challenge posts that aren't feed-visible
    let query = supabase
      .from("posts")
      .select(selectFields)
      .eq("is_hidden", false)
      .eq("is_feed_visible", true)
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
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = await getEffectiveUserId(request);

    if (!user || !effectiveUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createPostSchema.parse(body);

    // When impersonating, RLS requires auth.uid() = author_id; use admin client to write as effective user
    const writeClient = effectiveUserId !== user.id ? createAdminClient() : supabase;

    const insertData: Record<string, unknown> = {
      author_id: effectiveUserId,
      content: validatedData.content,
      tags: validatedData.tags || [],
    };

    if (validatedData.challenge_id) {
      insertData.challenge_id = validatedData.challenge_id;
    }
    if (validatedData.block_id) {
      insertData.block_id = validatedData.block_id;
    }
    if (validatedData.is_feed_visible !== undefined) {
      insertData.is_feed_visible = validatedData.is_feed_visible;
    }

    const { data: post, error: postError } = await writeClient
      .from("posts")
      .insert(insertData)
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

      const { error: mediaError } = await writeClient
        .from("post_media")
        .insert(mediaInserts);

      if (mediaError) {
        // Rollback post creation
        await writeClient.from("posts").delete().eq("id", post.id);
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
        comments (id),
        challenges (id, title, cover_image_url)
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
