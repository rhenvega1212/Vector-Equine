import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/admin/impersonate";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const effectiveUserId = await getEffectiveUserId(request);

    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "10", 10),
      30
    );

    const { data: posts, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
        post_media (*),
        post_likes (user_id),
        comments (id)
      `
      )
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit * 3);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const withLikeCount = (posts ?? []).map((p: any) => ({
      ...p,
      _likes_count: p.post_likes?.length ?? 0,
    }));
    withLikeCount.sort((a: any, b: any) => b._likes_count - a._likes_count);
    const trending = withLikeCount.slice(0, limit).map(({ _likes_count, ...p }) => p);

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

    return NextResponse.json({
      posts: trending,
      following_author_ids: followingAuthorIds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
