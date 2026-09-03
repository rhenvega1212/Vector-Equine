import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestCaptureToken } from "@/lib/capture/guest-token";
import { cleanAsrText } from "@/lib/capture/asr-cleanup";
import { emptyQualitySignals, flagSegment } from "@/lib/capture/asr-flags";
import { browserProvenance } from "@/lib/capture/asr-provenance";
import { z } from "zod";

const LEGACY_SELECT_COLS =
  "id, offset_ms, ended_offset_ms, speaker, text, confidence, created_at, raw_json";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const segmentSchema = z.object({
  client_id: z.string().uuid().or(z.string().min(8).max(80)).optional().nullable(),
  offset_ms: z.number().int().min(0),
  ended_offset_ms: z.number().int().min(0).optional().nullable(),
  speaker: z.enum(["rider", "trainer", "system", "vector"]),
  text: z.string().min(1).max(4000),
  confidence: z.number().min(0).max(1).optional().nullable(),
  raw_json: z.record(z.unknown()).optional().nullable(),
  addressed_to_vector: z.boolean().optional(),
  excluded_from_corpus: z.boolean().optional(),
});

const batchSchema = z.object({
  segments: z.array(segmentSchema).min(1).max(50),
});

type SegmentIn = z.infer<typeof segmentSchema>;

type DbClient = ReturnType<typeof createAdminClient>;

type SavedRow = {
  id: string;
  offset_ms: number;
  speaker: string;
  text: string;
  text_cleaned?: string | null;
  client_id: string | null;
  raw_json?: Record<string, unknown> | null;
};

const RETURN_COLS =
  "id, offset_ms, speaker, text, text_cleaned, client_id, raw_json";
const LEGACY_RETURN_COLS = "id, offset_ms, speaker, text";

/** Only these speakers carry ASR text. App-authored lines are never flagged. */
function isAsrSpeaker(speaker: string): boolean {
  return speaker === "rider" || speaker === "trainer";
}

async function insertIdempotent(
  db: DbClient,
  captureSessionId: string,
  segments: SegmentIn[],
  forceSpeaker?: "trainer"
) {
  const clientIds = segments
    .map((s) => s.client_id?.trim())
    .filter((id): id is string => !!id);

  const existingByClient = new Map<string, SavedRow>();

  if (clientIds.length > 0) {
    const { data: existing, error: existingError } = await db
      .from("session_transcript_segments")
      .select(RETURN_COLS)
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

  const inserted: SavedRow[] = [];

  if (toInsert.length > 0) {
    const rows = toInsert.map((s) => {
      const sp = forceSpeaker ?? s.speaker;
      // The client sends what it heard. Cleaning and flagging happen here, once,
      // so there is only ever one implementation of either.
      const raw = s.text.trim();
      const asr = isAsrSpeaker(sp);
      const flag = asr ? flagSegment(raw) : { excluded: false, reason: null };
      const cleaned = asr ? cleanAsrText(raw) : raw;
      return {
        capture_session_id: captureSessionId,
        client_id: s.client_id?.trim() || null,
        offset_ms: s.offset_ms,
        ended_offset_ms: s.ended_offset_ms ?? null,
        speaker: sp,
        text: raw,
        text_cleaned: cleaned || null,
        confidence: s.confidence ?? null,
        addressed_to_vector: s.addressed_to_vector ?? false,
        excluded_from_corpus:
          sp === "vector" || s.excluded_from_corpus === true || flag.excluded,
        raw_json: {
          // Present and null rather than absent: the browser reports none of
          // Whisper's signals, and a consumer should not have to tell the
          // difference between "no signal" and "field never written".
          ...(asr
            ? { ...browserProvenance(), quality: emptyQualitySignals() }
            : {}),
          ...(s.raw_json || {}),
          ...(s.client_id ? { client_id: s.client_id } : {}),
          ...(flag.reason ? { exclusion_reason: flag.reason } : {}),
        },
      };
    });

    // Upsert, not insert: a single duplicate client_id from a barn-WiFi retry
    // must not discard every other utterance in the batch.
    let { data, error } = await db
      .from("session_transcript_segments")
      .upsert(rows, {
        onConflict: "capture_session_id,client_id",
        ignoreDuplicates: true,
      })
      .select(RETURN_COLS);

    // Columns not migrated yet — insert what always exists (raw_json still
    // carries client_id, and text is the same string either way)
    if (error && /client_id|text_cleaned/i.test(error.message)) {
      const legacyRows = toInsert.map((s) => {
        const sp = forceSpeaker ?? s.speaker;
        const raw = s.text.trim();
        const asr = isAsrSpeaker(sp);
        const flag = asr ? flagSegment(raw) : { excluded: false, reason: null };
        return {
          capture_session_id: captureSessionId,
          offset_ms: s.offset_ms,
          ended_offset_ms: s.ended_offset_ms ?? null,
          speaker: sp,
          text: raw,
          confidence: s.confidence ?? null,
          raw_json: {
            ...(asr
              ? { ...browserProvenance(), quality: emptyQualitySignals() }
              : {}),
            ...(s.raw_json || {}),
            ...(s.client_id ? { client_id: s.client_id } : {}),
            ...(flag.reason ? { exclusion_reason: flag.reason } : {}),
          },
        };
      });
      const legacy = await db
        .from("session_transcript_segments")
        .insert(legacyRows)
        .select(LEGACY_RETURN_COLS);
      data = (legacy.data || []).map((r) => ({
        ...r,
        client_id: null,
        text_cleaned: null,
        raw_json: null,
      }));
      error = legacy.error;
    }

    if (error) {
      if (/duplicate|unique/i.test(error.message) && clientIds.length > 0) {
        const { data: again } = await db
          .from("session_transcript_segments")
          .select(RETURN_COLS)
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

    // ignoreDuplicates leaves conflicting rows out of the response. Fetch the
    // ones another writer landed first so the caller still gets every id back.
    if ((data?.length ?? 0) < toInsert.length && clientIds.length > 0) {
      const { data: raced } = await db
        .from("session_transcript_segments")
        .select(RETURN_COLS)
        .eq("capture_session_id", captureSessionId)
        .in("client_id", clientIds);
      for (const row of raced || []) {
        if (
          row.client_id &&
          !inserted.some((r) => r.client_id === row.client_id)
        ) {
          inserted.push(row);
        }
      }
    }
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
  }).filter(Boolean) as SavedRow[];

  return { error: null as string | null, segments: ordered };
}

/**
 * What goes back to the phone gets painted and broadcast to the peer, so it is
 * display text. Flagged rows are stored but not echoed — same as before, when
 * they were never stored at all.
 */
function toSavedRows(rows: SavedRow[]) {
  const out: Array<{
    id: string;
    offset_ms: number;
    speaker: string;
    text: string;
    client_id: string | null;
  }> = [];
  for (const r of rows) {
    const reason = (r.raw_json as { exclusion_reason?: unknown } | null)
      ?.exclusion_reason;
    if (typeof reason === "string" && reason) continue;
    const text = r.text_cleaned?.trim() || cleanAsrText(r.text);
    if (!text) continue;
    out.push({
      id: r.id,
      offset_ms: r.offset_ms,
      speaker: r.speaker,
      text,
      client_id: r.client_id ?? null,
    });
  }
  return out;
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
      return NextResponse.json({ segments: toSavedRows(segments) }, { status: 201 });
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
    return NextResponse.json({ segments: toSavedRows(segments) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * The live transcript is a display surface, so it reads cleaned and drops
 * flagged rows. Without this, "Thanks for watching" appears on a rider's phone
 * mid-lesson now that storage keeps what Whisper actually returned.
 */
function toDisplayRows(rows: Array<Record<string, unknown>>) {
  const out: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const flag =
      (r.flag_reason as string | null) ||
      ((r.raw_json as { exclusion_reason?: unknown } | null)
        ?.exclusion_reason as string | undefined) ||
      null;
    if (flag) continue;
    const cleanedCol = (r.text_cleaned as string | null)?.trim();
    const text = cleanedCol || cleanAsrText(String(r.text ?? ""));
    if (!text) continue;
    out.push({
      id: r.id,
      offset_ms: r.offset_ms,
      ended_offset_ms: r.ended_offset_ms,
      speaker: r.speaker,
      text,
      confidence: r.confidence,
      client_id: r.client_id ?? null,
      created_at: r.created_at,
    });
  }
  return out;
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
      "id, offset_ms, ended_offset_ms, speaker, text, text_cleaned, confidence, client_id, created_at, raw_json, flag_reason";

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
        // Columns may not be migrated yet — fall back to what always exists
        if (/client_id|text_cleaned|flag_reason/i.test(error.message)) {
          let q2 = admin
            .from("session_transcript_segments")
            .select(LEGACY_SELECT_COLS)
            .eq("capture_session_id", id)
            .order("offset_ms", { ascending: true });
          if (incremental) q2 = q2.gt("offset_ms", afterOffset);
          const retry = await q2;
          if (retry.error) {
            return NextResponse.json({ error: retry.error.message }, { status: 400 });
          }
          return NextResponse.json({ segments: toDisplayRows(retry.data || []) });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ segments: toDisplayRows(data || []) });
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
      if (/client_id|text_cleaned|flag_reason/i.test(error.message)) {
        let q2 = supabase
          .from("session_transcript_segments")
          .select(LEGACY_SELECT_COLS)
          .eq("capture_session_id", id)
          .order("offset_ms", { ascending: true });
        if (incremental) q2 = q2.gt("offset_ms", afterOffset);
        const retry = await q2;
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 400 });
        }
        return NextResponse.json({ segments: toDisplayRows(retry.data || []) });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ segments: toDisplayRows(data || []) });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
