import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const segmentSchema = z.object({
  client_id: z.string().uuid().or(z.string().min(8).max(80)).optional().nullable(),
  offset_ms: z.number().int().min(0),
  ended_offset_ms: z.number().int().min(0).optional().nullable(),
  speaker: z.enum(["rider", "trainer", "system"]),
  text: z.string().min(1).max(4000),
  confidence: z.number().min(0).max(1).optional().nullable(),
  raw_json: z.record(z.unknown()).optional().nullable(),
});

const batchSchema = z.object({
  segments: z.array(segmentSchema).min(1).max(50),
});

type SegmentIn = z.infer<typeof segmentSchema>;

type DbClient = ReturnType<typeof createAdminClient>;

async function insertIdempotent(
  db: DbClient,
  captureSessionId: string,
  segments: SegmentIn[],
  forceSpeaker?: "trainer"
) {
  const clientIds = segments
    .map((s) => s.client_id?.trim())
    .filter((id): id is string => !!id);

  const existingByClient = new Map<
    string,
    { id: string; offset_ms: number; speaker: string; text: string; client_id: string | null }
  >();

  if (clientIds.length > 0) {
    const { data: existing, error: existingError } = await db
      .from("session_transcript_segments")
      .select("id, offset_ms, speaker, text, client_id")
      .eq("capture_session_id", captureSessionId)
      .in("client_id", clientIds);
    if (!existingError) {
      for (const row of existing || []) {
        if (row.client_id) existingByClient.set(row.client_id, row);
      }
    }
    // If client_id column missing, skip pre-check — insert path handles fallback
  }

  const toInsert = segments.filter(
    (s) => !s.client_id || !existingByClient.has(s.client_id)
  );

  const inserted: {
    id: string;
    offset_ms: number;
    speaker: string;
    text: string;
    client_id: string | null;
  }[] = [];

  if (toInsert.length > 0) {
    const rows = toInsert.map((s) => ({
      capture_session_id: captureSessionId,
      client_id: s.client_id?.trim() || null,
      offset_ms: s.offset_ms,
      ended_offset_ms: s.ended_offset_ms ?? null,
      speaker: forceSpeaker ?? s.speaker,
      text: s.text.trim(),
      confidence: s.confidence ?? null,
      raw_json: {
        ...(s.raw_json || {}),
        ...(s.client_id ? { client_id: s.client_id } : {}),
      },
    }));

    let { data, error } = await db
      .from("session_transcript_segments")
      .insert(rows)
      .select("id, offset_ms, speaker, text, client_id");

    // Column not migrated yet — insert without client_id (raw_json still carries it)
    if (error && /client_id/i.test(error.message)) {
      const legacyRows = toInsert.map((s) => ({
        capture_session_id: captureSessionId,
        offset_ms: s.offset_ms,
        ended_offset_ms: s.ended_offset_ms ?? null,
        speaker: forceSpeaker ?? s.speaker,
        text: s.text.trim(),
        confidence: s.confidence ?? null,
        raw_json: {
          ...(s.raw_json || {}),
          ...(s.client_id ? { client_id: s.client_id } : {}),
        },
      }));
      const legacy = await db
        .from("session_transcript_segments")
        .insert(legacyRows)
        .select("id, offset_ms, speaker, text");
      data = (legacy.data || []).map((r) => ({ ...r, client_id: null }));
      error = legacy.error;
    }

    if (error) {
      if (/duplicate|unique/i.test(error.message) && clientIds.length > 0) {
        const { data: again } = await db
          .from("session_transcript_segments")
          .select("id, offset_ms, speaker, text, client_id")
          .eq("capture_session_id", captureSessionId)
          .in("client_id", clientIds);
        return {
          error: null as string | null,
          segments: again || Array.from(existingByClient.values()),
        };
      }
      return { error: error.message, segments: [] as typeof inserted };
    }
    inserted.push(...(data || []));
  }

  // Preserve request order: existing matches + new inserts
  const byClient = new Map<string, (typeof inserted)[0]>();
  for (const row of Array.from(existingByClient.values())) {
    if (row.client_id) byClient.set(row.client_id, row);
  }
  for (const row of inserted) {
    if (row.client_id) byClient.set(row.client_id, row);
  }

  const ordered = segments.map((s) => {
    if (s.client_id && byClient.has(s.client_id)) return byClient.get(s.client_id)!;
    return (
      inserted.find(
        (r) => r.offset_ms === s.offset_ms && r.text === s.text.trim()
      ) || null
    );
  }).filter(Boolean) as typeof inserted;

  return { error: null as string | null, segments: ordered };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = batchSchema.parse(body);

    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      if (!claims || claims.captureSessionId !== id) {
        return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
      }
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
      }
      const admin = createAdminClient();
      const { data: capture } = await admin
        .from("capture_sessions")
        .select("id, status")
        .eq("id", id)
        .maybeSingle();
      if (!capture || !["waiting", "live"].includes(capture.status)) {
        return NextResponse.json({ error: "Session not live" }, { status: 400 });
      }

      const { error, segments } = await insertIdempotent(
        admin,
        id,
        parsed.segments,
        "trainer"
      );
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      return NextResponse.json({ segments }, { status: 201 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: capture } = await supabase
      .from("capture_sessions")
      .select("id, status")
      .eq("id", id)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!capture || !["waiting", "live"].includes(capture.status)) {
      return NextResponse.json({ error: "Session not found or not live" }, { status: 400 });
    }

    if (capture.status === "waiting") {
      await supabase
        .from("capture_sessions")
        .update({ status: "live" })
        .eq("id", id);
    }

    const { error, segments } = await insertIdempotent(
      supabase as unknown as DbClient,
      id,
      parsed.segments
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ segments }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const afterOffsetRaw = request.nextUrl.searchParams.get("after_offset_ms");
    const afterOffset =
      afterOffsetRaw != null && afterOffsetRaw !== ""
        ? Number.parseInt(afterOffsetRaw, 10)
        : null;
    const incremental =
      afterOffset != null && Number.isFinite(afterOffset) && afterOffset >= 0;

    const authHeader = request.headers.get("authorization");
    const guestToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const selectCols =
      "id, offset_ms, ended_offset_ms, speaker, text, confidence, client_id, created_at";

    if (guestToken) {
      const claims = verifyGuestCaptureToken(guestToken);
      if (!claims || claims.captureSessionId !== id) {
        return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
      }
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
      }
      const admin = createAdminClient();
      const { data: capture } = await admin
        .from("capture_sessions")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (!capture) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      let q = admin
        .from("session_transcript_segments")
        .select(selectCols)
        .eq("capture_session_id", id)
        .order("offset_ms", { ascending: true });
      if (incremental) {
        q = q.gt("offset_ms", afterOffset);
      }
      const { data, error } = await q;
      if (error) {
        // client_id column may not exist yet — fall back without it
        if (/client_id/i.test(error.message)) {
          let q2 = admin
            .from("session_transcript_segments")
            .select(
              "id, offset_ms, ended_offset_ms, speaker, text, confidence, created_at"
            )
            .eq("capture_session_id", id)
            .order("offset_ms", { ascending: true });
          if (incremental) q2 = q2.gt("offset_ms", afterOffset);
          const retry = await q2;
          if (retry.error) {
            return NextResponse.json({ error: retry.error.message }, { status: 400 });
          }
          return NextResponse.json({ segments: retry.data || [] });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ segments: data || [] });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: capture } = await supabase
      .from("capture_sessions")
      .select("id")
      .eq("id", id)
      .eq("rider_id", user.id)
      .maybeSingle();

    if (!capture) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let q = supabase
      .from("session_transcript_segments")
      .select(selectCols)
      .eq("capture_session_id", id)
      .order("offset_ms", { ascending: true });
    if (incremental) {
      q = q.gt("offset_ms", afterOffset);
    }
    const { data, error } = await q;

    if (error) {
      if (/client_id/i.test(error.message)) {
        let q2 = supabase
          .from("session_transcript_segments")
          .select(
            "id, offset_ms, ended_offset_ms, speaker, text, confidence, created_at"
          )
          .eq("capture_session_id", id)
          .order("offset_ms", { ascending: true });
        if (incremental) q2 = q2.gt("offset_ms", afterOffset);
        const retry = await q2;
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 400 });
        }
        return NextResponse.json({ segments: retry.data || [] });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ segments: data || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
