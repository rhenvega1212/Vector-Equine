import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { formatOffset } from "@/lib/capture/summary";
import type { AskSource, AskTurn } from "@/lib/ask/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const answerSchema = z.object({
  answer: z
    .string()
    .max(1200)
    .describe("Spoken-ready answer. Attribution rules apply."),
  sources: z
    .array(
      z.object({
        label: z
          .string()
          .max(24)
          .describe("Short gold column value e.g. 14:22 or Jul 21"),
        text: z.string().max(200).describe("One-line source description"),
        kind: z.enum(["transcript", "moment", "measurement", "ride"]),
        atSec: z.number().int().min(0).optional(),
        rideId: z.string().uuid().optional(),
        measurementId: z.string().optional(),
      })
    )
    .max(4),
});

function mapSources(
  raw: z.infer<typeof answerSchema>["sources"]
): AskSource[] {
  const out: AskSource[] = [];
  for (const s of raw) {
    if (s.kind === "transcript" || s.kind === "moment") {
      if (s.atSec == null) continue;
      out.push({
        label: s.label,
        text: s.text,
        ref: { kind: s.kind, atSec: s.atSec },
      });
    } else if (s.kind === "ride" && s.rideId) {
      out.push({
        label: s.label,
        text: s.text,
        ref: { kind: "ride", rideId: s.rideId },
      });
    } else if (s.kind === "measurement" && s.measurementId) {
      out.push({
        label: s.label,
        text: s.text,
        ref: { kind: "measurement", id: s.measurementId },
      });
    }
  }
  return out;
}

function rowToTurn(row: {
  id: string;
  question: string;
  answer: string;
  asked_by_voice: boolean;
  sources: unknown;
  created_at: string;
}): AskTurn {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    askedByVoice: !!row.asked_by_voice,
    sources: Array.isArray(row.sources) ? (row.sources as AskSource[]) : [],
    createdAt: row.created_at,
  };
}

/** List persisted turns for this lesson. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: session } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from("session_ask_turns")
      .select("id, question, answer, asked_by_voice, sources, created_at")
      .eq("training_session_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      // Table may not be migrated yet
      console.error("ask turns list", error);
      return NextResponse.json({ turns: [] as AskTurn[] });
    }

    return NextResponse.json({
      turns: (rows || []).map(rowToTurn),
    });
  } catch (e) {
    console.error("ask GET", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

/** Ask a question; persist turn; optionally return TTS audio (base64 mp3). */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Can't reach Vector right now." },
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

    const body = await request.json().catch(() => ({}));
    const question = String(body.question || "").trim();
    const askedByVoice = !!body.askedByVoice;
    if (!question) {
      return NextResponse.json({ error: "Didn't catch that." }, { status: 400 });
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

    let horseName = session.horse?.trim() || "Horse";
    let horseFocus: string | null = null;

    const horsePromise = session.horse_id
      ? supabase
          .from("horse_profiles")
          .select("name, barn_name, current_focus")
          .eq("id", session.horse_id)
          .maybeSingle()
      : Promise.resolve({ data: null as null });

    const capturePromise = supabase
      .from("capture_sessions")
      .select("id, trainer_display_name")
      .eq("training_session_id", id)
      .maybeSingle();

    const [{ data: horse }, { data: capture }] = await Promise.all([
      horsePromise,
      capturePromise,
    ]);

    if (horse) {
      horseName = horse.barn_name?.trim() || horse.name || horseName;
      horseFocus = horse.current_focus ?? null;
    }

    let transcript = "";
    if (capture?.id) {
      const { data: segments } = await supabase
        .from("session_transcript_segments")
        .select("speaker, text, offset_ms")
        .eq("capture_session_id", capture.id)
        .order("offset_ms", { ascending: true })
        .limit(80);
      transcript = (segments || [])
        .map(
          (s) =>
            `${s.speaker} · ${formatOffset(s.offset_ms)} · ${s.text.trim()}`
        )
        .join("\n");
      // Cap prompt size so the model stays quick
      if (transcript.length > 8000) {
        transcript = transcript.slice(transcript.length - 8000);
      }
    }

    const trainerName =
      capture?.trainer_display_name ||
      (typeof session.notes === "string" && session.notes.startsWith("With ")
        ? session.notes.replace(/^With\s+/, "")
        : null);
    const trainerFirst =
      (trainerName || "the trainer").trim().split(/\s+/)[0] || "the trainer";

    const anthropic = createAnthropic({ apiKey });
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5"),
      schema: answerSchema,
      temperature: 0.2,
      maxOutputTokens: 500,
      system: `You are Vector — a calm voice in a quiet room with a rider reviewing one lesson.
Never say you are an AI or language model. Speak as Vector.

ATTRIBUTION (absolute):
- You never issue coaching in your own name. No "you should," no commands from Vector.
- Prescriptive content must quote ${trainerFirst} by name, or name a concrete exercise from the lesson.
- Numbers are measurements stated flat — no conclusions attached.
- Cross-ride comparison is factual only ("It went the same way on Jul 21.").
- If evidence is missing: one line — "I don't know from this lesson." Do not apologise twice.
- Never invent sensor readings, medical claims, or diagnoses.

VOICE:
- Short, spoken aloud. 2–5 sentences max unless they ask for more.
- Warm, practical, alongside their trainer.

SOURCES:
- Return 0–4 sources that actually support the answer.
- Prefer transcript/moment timestamps from the lesson (atSec in seconds).
- label is the gold column (mm:ss or a short date).`,
      prompt: `Horse: ${horseName}
Horse focus: ${horseFocus || "not set"}
Trainer: ${trainerName || "not recorded"}
Title: ${session.session_title || "Lesson"}
When: ${session.session_date}
Duration: ${session.duration_minutes != null ? `${session.duration_minutes} min` : "unknown"}

BRIEF:
${session.summary || "(none)"}

HOMEWORK:
${session.homework || "(none)"}

EXERCISES:
${session.exercises || "(none)"}

TRANSCRIPT:
${transcript || "(empty)"}

RIDER QUESTION:
${question}`,
    });

    const sources = mapSources(object.sources);
    const answer = object.answer.trim();

    const { data: inserted, error: insertError } = await supabase
      .from("session_ask_turns")
      .insert({
        training_session_id: id,
        user_id: user.id,
        question,
        answer,
        asked_by_voice: askedByVoice,
        sources,
      })
      .select("id, question, answer, asked_by_voice, sources, created_at")
      .single();

    // Return text immediately — client fetches TTS in parallel so speech
    // doesn't block the answer appearing.
    if (insertError || !inserted) {
      console.error("ask turn insert", insertError);
      const turn: AskTurn = {
        id: crypto.randomUUID(),
        question,
        answer,
        askedByVoice,
        sources,
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json({
        turn,
        audioBase64: null,
        persisted: false,
      });
    }

    return NextResponse.json({
      turn: rowToTurn(inserted),
      audioBase64: null,
      persisted: true,
    });
  } catch (e) {
    console.error("ask POST", e);
    return NextResponse.json(
      { error: "Can't reach Vector right now." },
      { status: 500 }
    );
  }
}
