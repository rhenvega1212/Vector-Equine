import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { isFlagEnabled } from "@/lib/flags/server";
import { generateCalledTurn } from "@/lib/capture/generate-called-turn";
import type { HomeworkContextRow } from "@/lib/capture/vector-turn";
import { synthesizeAskSpeech } from "@/lib/ask/tts";
import {
  classifyTurnIntent,
  isIntelligibleQuestion,
} from "@/lib/capture/wake-word";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  question: z.string().min(1).max(800),
  askedBy: z.enum(["rider", "trainer"]),
  offsetMs: z.number().int().min(0).optional(),
  riderFirst: z.string().nullable().optional(),
  trainerFirst: z.string().nullable().optional(),
  crossingLineAlreadySaid: z.boolean().optional(),
  declinedTexts: z.array(z.string().max(400)).max(12).optional(),
  /** Client already handled stop/replay — only ask hits generation. */
  intent: z.enum(["ask", "stop", "replay"]).optional(),
});

async function authorizeCapture(
  id: string,
  guestToken: string | null
): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  riderId?: string;
  isTest?: boolean;
}> {
  if (guestToken) {
    const claims = verifyGuestCaptureToken(guestToken);
    if (!claims || claims.captureSessionId !== id) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    return { ok: true };
  }

  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) {
    return { ok: false, status: 401, error: "Authentication required" };
  }
  const supabase = await createClient();
  const { data: captureRow } = await supabase
    .from("capture_sessions")
    .select("id, is_test, rider_id, trainer_id")
    .eq("id", id)
    .maybeSingle();
  if (!captureRow) {
    return { ok: false, status: 404, error: "Not found" };
  }
  const row = captureRow as {
    is_test?: boolean;
    rider_id: string;
    trainer_id?: string | null;
  };
  const isParty =
    row.rider_id === user.id || row.trainer_id === user.id;
  if (!isParty) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  const isTest = Boolean(row.is_test);
  const flagOn =
    isTest || (await isFlagEnabled("vector_in_session", profile));
  if (!flagOn) {
    return { ok: false, status: 403, error: "Not available" };
  }
  return { ok: true, riderId: row.rider_id, isTest };
}

async function loadHomework(
  riderId: string | null | undefined
): Promise<HomeworkContextRow[]> {
  if (!riderId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("training_sessions")
    .select(
      "id, session_date, homework, exercises, overall_feel, feel_scale, notes, user_id"
    )
    .eq("user_id", riderId)
    .order("session_date", { ascending: false })
    .limit(40);

  const rows = (data || []) as Array<{
    id: string;
    session_date: string;
    homework: string | null;
    exercises: string | null;
    overall_feel: number | null;
    feel_scale: 5 | 10 | null;
    notes: string | null;
  }>;

  return rows
    .filter((r) => (r.homework || r.exercises || "").trim())
    .map((r) => {
      const trainerName =
        typeof r.notes === "string" && r.notes.startsWith("With ")
          ? r.notes.replace(/^With\s+/, "").trim()
          : null;
      return {
        sessionId: r.id,
        trainerId: null,
        trainerName,
        sessionDate: r.session_date,
        exercises: r.exercises,
        homework: r.homework,
        overallFeel: r.overall_feel,
        feelScale: r.feel_scale,
      } satisfies HomeworkContextRow;
    });
}

/**
 * Called turn — generate reply (+ optional TTS). Latency: speak if fast enough.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const t0 = Date.now();
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const question = parsed.data.question.trim();
    const intent =
      parsed.data.intent || classifyTurnIntent(question);

    if (intent === "stop" || intent === "replay") {
      return NextResponse.json({
        intent,
        silent: false,
        offer: null,
        speak: false,
      });
    }

    if (!isIntelligibleQuestion(question)) {
      return NextResponse.json({ intent: "ask", silent: true });
    }

    const auth = await authorizeCapture(id, guestToken);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error || "Forbidden" },
        { status: auth.status || 403 }
      );
    }

    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : null;
    const db = admin || (await createClient());

    let riderId = auth.riderId;
    if (!riderId) {
      const { data: cap } = await db
        .from("capture_sessions")
        .select("rider_id")
        .eq("id", id)
        .maybeSingle();
      riderId = (cap as { rider_id?: string } | null)?.rider_id;
    }

    const homeworkRows = await loadHomework(riderId);
    const result = await generateCalledTurn({
      question,
      askedBy: parsed.data.askedBy,
      riderFirst: parsed.data.riderFirst ?? null,
      trainerFirst: parsed.data.trainerFirst ?? null,
      homeworkRows,
      crossingLineAlreadySaid: Boolean(parsed.data.crossingLineAlreadySaid),
      declinedTexts: parsed.data.declinedTexts,
    });

    const spokenText = [result.crossingLine, result.offer.text]
      .filter(Boolean)
      .join(" ");

    const offsetMs = parsed.data.offsetMs ?? 0;
    await db.from("session_transcript_segments").insert({
      capture_session_id: id,
      offset_ms: offsetMs,
      speaker: "vector",
      text: spokenText,
      client_id: `vector:turn:${offsetMs}:${Date.now()}`,
      excluded_from_corpus: true,
      addressed_to_vector: false,
      raw_json: {
        kind: "called_turn",
        grounding: result.offer.grounding,
        offerKind: result.offer.kind,
        model: result.model,
        latencyMs: result.latencyMs,
        provenance: result.offer.provenance,
        attribution: result.offer.attribution ?? null,
        question,
        askedBy: parsed.data.askedBy,
      },
    });

    const elapsed = Date.now() - t0;
    // Under 2.5s → speak; 2.5–4s → screen only; past 4s → still return text (client may skip TTS)
    const speak = elapsed < 2500;
    const abandonAudio = elapsed >= 4000;

    let audio: ArrayBuffer | null = null;
    if (speak && !abandonAudio) {
      audio = await synthesizeAskSpeech(spokenText);
    }

    if (audio && audio.byteLength) {
      return new NextResponse(Buffer.from(audio), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-Vector-Text": encodeURIComponent(spokenText),
          "X-Vector-Kind": result.offer.kind,
          "X-Vector-Grounding": result.offer.grounding,
          "X-Vector-Crossing": result.crossingLine ? "1" : "0",
          "X-Vector-Latency": String(elapsed),
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      intent: "ask",
      silent: false,
      speak: false,
      text: spokenText,
      offer: result.offer,
      crossingLine: result.crossingLine,
      latencyMs: elapsed,
    });
  } catch (e) {
    console.error("vector turn", e);
    // Failure: one calm line on screen, never spoken (Brief §5.8 / §8)
    return NextResponse.json(
      {
        intent: "ask",
        silent: false,
        speak: false,
        text: "Couldn't get that — try again in a moment.",
        failure: true,
      },
      { status: 200 }
    );
  }
}
