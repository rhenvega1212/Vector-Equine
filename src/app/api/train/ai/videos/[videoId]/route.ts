import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: video, error: videoError } = await supabase
      .from("ai_video_uploads")
      .select("id, file_url, horse, notes, created_at")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const { data: analysis, error: analysisError } = await supabase
      .from("ai_analyses")
      .select("*")
      .eq("video_id", videoId)
      .single();

    if (analysisError && analysisError.code !== "PGRST116") {
      return NextResponse.json({ error: analysisError.message }, { status: 400 });
    }

    return NextResponse.json({ video, analysis: analysis ?? null });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
