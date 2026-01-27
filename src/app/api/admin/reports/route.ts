import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    let query = supabase
      .from("reports")
      .select(`
        *,
        reporter:profiles!reports_reporter_id_fkey (id, username, display_name)
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: reports, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Fetch post and comment details for each report
    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        let post = null;
        let comment = null;

        if (report.post_id) {
          const { data: postData } = await supabase
            .from("posts")
            .select(`
              id,
              content,
              is_hidden,
              profiles!posts_author_id_fkey (username, display_name)
            `)
            .eq("id", report.post_id)
            .single();

          if (postData) {
            post = {
              id: postData.id,
              content: postData.content,
              is_hidden: postData.is_hidden,
              author: postData.profiles,
            };
          }
        }

        if (report.comment_id) {
          const { data: commentData } = await supabase
            .from("comments")
            .select("id, content")
            .eq("id", report.comment_id)
            .single();
          comment = commentData;
        }

        return {
          ...report,
          post,
          comment,
        };
      })
    );

    return NextResponse.json({ reports: enrichedReports });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
