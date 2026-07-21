import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { formatOffset } from "@/lib/capture/summary";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function buildSystemPrompt(ctx: {
  horseName: string;
  horseFocus: string | null;
  trainerName: string | null;
  title: string;
  summary: string | null;
  homework: string | null;
  exercises: string | null;
  when: string;
  duration: number | null;
  transcript: string;
}) {
  return `You are Vector — a calm equestrian coaching voice for the rider reviewing one captured lesson.
Never say you are an AI or language model. Speak as Vector.

GROUNDING RULES (must follow):
- Prefer answers supported by the lesson brief and transcript below.
- When you use a coach cue, cite the timestamp like (12:40).
- If the lesson evidence is missing or unclear, say exactly: "I don't know from this lesson" (you may add one short suggestion to check with their trainer).
- Never invent biomechanics scores, sensor readings, or medical diagnoses. Health: flag only; never diagnose.
- Keep answers concise and practical for a rider on their phone.

LESSON CONTEXT:
- Title: ${ctx.title}
- Horse: ${ctx.horseName}
- Horse current focus: ${ctx.horseFocus || "not set"}
- Trainer: ${ctx.trainerName || "not recorded"}
- When: ${ctx.when}
- Duration: ${ctx.duration != null ? `${ctx.duration} min` : "unknown"}

BRIEF:
${ctx.summary || "(no summary yet)"}

HOMEWORK:
${ctx.homework || "(none)"}

KEY WORK:
${ctx.exercises || "(none)"}

TRANSCRIPT (speaker · offset · text):
${ctx.transcript || "(empty — no speech segments)"}
`;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Claude is not configured. Add ANTHROPIC_API_KEY to the environment and redeploy.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: session } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json();
    const messages = (body.messages || []) as UIMessage[];

    let horseName = session.horse?.trim() || "Horse";
    let horseFocus: string | null = null;
    if (session.horse_id) {
      const { data: horse } = await supabase
        .from("horse_profiles")
        .select("name, barn_name, current_focus")
        .eq("id", session.horse_id)
        .maybeSingle();
      horseName = horse?.barn_name?.trim() || horse?.name || horseName;
      horseFocus = horse?.current_focus ?? null;
    }

    const { data: capture } = await supabase
      .from("capture_sessions")
      .select("id, trainer_display_name")
      .eq("training_session_id", id)
      .maybeSingle();

    let transcript = "";
    if (capture?.id) {
      const { data: segments } = await supabase
        .from("session_transcript_segments")
        .select("speaker, text, offset_ms")
        .eq("capture_session_id", capture.id)
        .order("offset_ms", { ascending: true })
        .limit(200);
      transcript = (segments || [])
        .map(
          (s) =>
            `${s.speaker} · ${formatOffset(s.offset_ms)} · ${s.text.trim()}`
        )
        .join("\n");
    }

    const trainerName =
      capture?.trainer_display_name ||
      (typeof session.notes === "string" && session.notes.startsWith("With ")
        ? session.notes.replace(/^With\s+/, "")
        : null);

    const anthropic = createAnthropic({ apiKey });
    const result = streamText({
      model: anthropic("claude-sonnet-4-5"),
      system: buildSystemPrompt({
        horseName,
        horseFocus,
        trainerName,
        title: session.session_title || "Lesson",
        summary: session.summary,
        homework: session.homework,
        exercises: session.exercises,
        when: String(session.session_date),
        duration: session.duration_minutes,
        transcript,
      }),
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (e) {
    console.error("ride chat error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 }
    );
  }
}
