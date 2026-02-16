import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const postSchema = z.object({ content: z.string().min(1) });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: analysis } = await supabase
      .from("ai_analyses")
      .select("id")
      .eq("id", analysisId)
      .single();
    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const { data: messages, error } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ messages: messages ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { content } = postSchema.parse(body);

    const { data: analysis } = await supabase
      .from("ai_analyses")
      .select("id")
      .eq("id", analysisId)
      .single();
    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const { data: userMsg, error: insertError } = await supabase
      .from("ai_chat_messages")
      .insert({ analysis_id: analysisId, role: "user", content })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const mockReply =
      "Based on your analysis: the key moments around 0:45 and 2:10 are good places to revisit. I’d focus next on relaxation in the downward transitions and keeping the rhythm consistent. Would you like a simple exercise to work on rhythm in trot?";
    const { data: assistantMsg } = await supabase
      .from("ai_chat_messages")
      .insert({ analysis_id: analysisId, role: "assistant", content: mockReply })
      .select()
      .single();

    return NextResponse.json({
      user_message: userMsg,
      assistant_message: assistantMsg ?? null,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
