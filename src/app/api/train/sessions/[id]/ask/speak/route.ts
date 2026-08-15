import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { synthesizeAskSpeech } from "@/lib/ask/tts";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Replay TTS for a persisted turn's answer text. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const turnId = String(body.turnId || "").trim();
    const text = String(body.text || "").trim();

    let speak = text;
    if (turnId) {
      const { data: turn } = await supabase
        .from("session_ask_turns")
        .select("answer, training_session_id")
        .eq("id", turnId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (turn && turn.training_session_id === id) {
        speak = turn.answer;
      } else if (!speak) {
        return NextResponse.json({ error: "Turn not found" }, { status: 404 });
      }
    }

    if (!speak) {
      return NextResponse.json({ error: "Nothing to speak" }, { status: 400 });
    }

    const audio = await synthesizeAskSpeech(speak);
    if (!audio) {
      return NextResponse.json(
        { error: "Speech unavailable", audioBase64: null },
        { status: 503 }
      );
    }

    return NextResponse.json({
      audioBase64: Buffer.from(audio).toString("base64"),
    });
  } catch (e) {
    console.error("ask speak", e);
    return NextResponse.json({ error: "Speech failed" }, { status: 500 });
  }
}
