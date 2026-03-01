import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") === "top" ? "top" : "newest";

    const { data: rawPosts, error } = await supabase
      .from("discussion_posts")
      .select(
        `
        id,
        block_id,
        user_id,
        content,
        parent_id,
        is_pinned,
        created_at,
        profiles:user_id (
          display_name,
          avatar_url,
          username
        )
      `
      )
      .eq("block_id", blockId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const postIds = (rawPosts ?? []).map((p) => p.id);

    const [replyCounts, reactionCounts, userReactions] = await Promise.all([
      supabase
        .from("discussion_posts")
        .select("parent_id")
        .in("parent_id", postIds.length ? postIds : [""]),

      supabase
        .from("discussion_reactions")
        .select("post_id")
        .in("post_id", postIds.length ? postIds : [""]),

      user
        ? supabase
            .from("discussion_reactions")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", postIds.length ? postIds : [""])
        : Promise.resolve({ data: [] }),
    ]);

    const replyMap = new Map<string, number>();
    for (const r of replyCounts.data ?? []) {
      replyMap.set(r.parent_id, (replyMap.get(r.parent_id) ?? 0) + 1);
    }

    const rxnMap = new Map<string, number>();
    for (const r of reactionCounts.data ?? []) {
      rxnMap.set(r.post_id, (rxnMap.get(r.post_id) ?? 0) + 1);
    }

    const userRxnSet = new Set(
      (userReactions.data ?? []).map((r) => r.post_id)
    );

    const posts = (rawPosts ?? []).map((p) => ({
      ...p,
      reply_count: replyMap.get(p.id) ?? 0,
      reaction_count: rxnMap.get(p.id) ?? 0,
      user_has_reacted: userRxnSet.has(p.id),
    }));

    if (sort === "top") {
      posts.sort((a, b) => b.reaction_count - a.reaction_count);
    }

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
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

    const body = await request.json();
    const { content, parent_id } = body as {
      content: string;
      parent_id?: string;
    };

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const { data: post, error } = await supabase
      .from("discussion_posts")
      .insert({
        block_id: blockId,
        user_id: user.id,
        content: content.trim(),
        parent_id: parent_id ?? null,
      })
      .select(
        `
        id,
        block_id,
        user_id,
        content,
        parent_id,
        is_pinned,
        created_at,
        profiles:user_id (
          display_name,
          avatar_url,
          username
        )
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(post, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
