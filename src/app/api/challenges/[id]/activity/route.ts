import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("user_id");
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("posts")
      .select(`
        *,
        profiles!posts_author_id_fkey (id, username, display_name, avatar_url, role),
        post_media (*),
        post_likes (user_id),
        comments (id),
        challenges (id, title, cover_image_url)
      `)
      .eq("is_hidden", false)
      .eq("challenge_id", challengeId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq("author_id", userId);
    }

    const { data: posts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", false)
      .eq("challenge_id", challengeId)
      .maybeSingle() as { count: number | null; error: any };

    return NextResponse.json({
      posts: posts ?? [],
      total: count ?? posts?.length ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
