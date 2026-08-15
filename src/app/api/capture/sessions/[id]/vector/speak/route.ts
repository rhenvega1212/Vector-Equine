import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { synthesizeAskSpeech } from "@/lib/ask/tts";
import {
  CLOSE_BOOKEND,
  openBookendLine,
} from "@/lib/capture/vector-session";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { isFlagEnabled } from "@/lib/flags/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  kind: z.enum(["open", "close"]),
  riderFirst: z.string().nullable().optional(),
  trainerFirst: z.string().nullable().optional(),
  offsetMs: z.number().int().min(0).optional(),
});

/**
 * Speak a bookend and persist as speaker=vector (excluded from corpus).
 * Guests may call for open/close so both phones hear disclosure.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : null;

    let allowed = false;
    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      allowed = Boolean(claims && claims.captureSessionId === id);
    } else {
      const { user, profile } = await getCurrentProfile();
      if (!user || !profile) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const flagOn = await isFlagEnabled("vector_in_session", profile);
      if (!flagOn) {
        return NextResponse.json({ error: "Not available" }, { status: 403 });
      }
      const supabase = await createClient();
      const { data } = await supabase
        .from("capture_sessions")
        .select("id")
        .eq("id", id)
        .eq("rider_id", user.id)
        .maybeSingle();
      allowed = Boolean(data);
    }

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const text =
      parsed.data.kind === "close"
        ? CLOSE_BOOKEND
        : openBookendLine({
            riderFirst: parsed.data.riderFirst ?? null,
            trainerFirst: parsed.data.trainerFirst ?? null,
          });

    const offsetMs = parsed.data.offsetMs ?? 0;
    const db = admin || (await createClient());

    await db.from("session_transcript_segments").insert({
      capture_session_id: id,
      offset_ms: offsetMs,
      speaker: "vector",
      text,
      client_id: `vector:${parsed.data.kind}:${offsetMs}`,
      excluded_from_corpus: true,
      raw_json: { kind: "bookend", bookend: parsed.data.kind },
    });

    const audio = await synthesizeAskSpeech(text);
    if (!audio) {
      return NextResponse.json({ text, spoken: false });
    }

    return new NextResponse(Buffer.from(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Vector-Text": encodeURIComponent(text),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("vector speak", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
