import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveUserId } from "@/lib/admin/impersonate";

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

    // Get post author to send notification
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .single();

    const writeClient = effectiveUserId !== user.id ? createAdminClient() : supabase;
    const { error } = await writeClient
      .from("post_likes")
      .insert({
        user_id: effectiveUserId,
        post_id: postId,
      });

    if (error) {
      // Handle duplicate like
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Already liked" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create notification for post author (don't notify yourself)
    if (post && post.author_id !== effectiveUserId) {
      await writeClient
        .from("notifications")
        .insert({
          user_id: post.author_id,
          type: "like",
          actor_id: effectiveUserId,
          post_id: postId,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const writeClient = effectiveUserId !== user.id ? createAdminClient() : supabase;
    const { error } = await writeClient
      .from("post_likes")
      .delete()
      .eq("user_id", effectiveUserId)
      .eq("post_id", postId);

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
