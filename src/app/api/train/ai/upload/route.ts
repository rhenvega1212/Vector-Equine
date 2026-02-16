import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  file_url: z.string().min(1),
  horse: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Mock analysis result for Phase 1
function mockAnalysisResult() {
  return {
    summary:
      "Overall this was a solid schooling session. The horse showed good rhythm in the working gaits with moments of improved connection in the second half. Areas to focus on: maintaining relaxation in transitions and straightness on the long side.",
    scores: {
      rhythm: 4,
      relaxation: 3,
      connection: 3,
      impulsion: 4,
      straightness: 3,
      collection: 3,
    },
    keyMoments: [
        { timestamp: "0:45", note: "Loss of rhythm in first trot transition." },
        { timestamp: "2:10", note: "Connection improves; horse softens into the contact." },
        { timestamp: "3:30", note: "Good straightness on center line." },
      ],
    suggestedFocus:
      "Next session: focus on relaxation in downward transitions and maintaining rhythm in extended trot. Consider 10 minutes of stretch work before asking for collection.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.parse(body);

    const { data: video, error: videoError } = await supabase
      .from("ai_video_uploads")
      .insert({
        user_id: user.id,
        file_url: parsed.file_url,
        horse: parsed.horse ?? null,
        notes: parsed.notes ?? null,
      })
      .select("id")
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: videoError?.message ?? "Failed to create upload" }, { status: 400 });
    }

    const resultJson = mockAnalysisResult();
    const { data: analysis, error: analysisError } = await supabase
      .from("ai_analyses")
      .insert({
        video_id: video.id,
        status: "complete",
        result_json: resultJson,
      })
      .select("id")
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: analysisError?.message ?? "Failed to create analysis" }, { status: 400 });
    }

    return NextResponse.json({ video_id: video.id, analysis_id: analysis.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
