/**
 * Re-run Claude cleanup + coach-card brief for one or more captures.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/repolish-captures.ts --session <training_session_id> [--session <id>...]
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/repolish-captures.ts --capture <capture_session_id> [...]
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildCoachCardSummary,
  cleanupTranscriptForJournal,
} from "../src/lib/capture/transcript-cleanup";
import { summarizeCaptureTranscript } from "../src/lib/capture/summary";

function parseArgs(argv: string[]) {
  const sessions: string[] = [];
  const captures: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--session" && argv[i + 1]) {
      sessions.push(argv[++i]);
    } else if (argv[i] === "--capture" && argv[i + 1]) {
      captures.push(argv[++i]);
    }
  }
  return { sessions, captures };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("Need ANTHROPIC_API_KEY for polish");
  }

  const { sessions, captures } = parseArgs(process.argv.slice(2));
  if (sessions.length === 0 && captures.length === 0) {
    throw new Error(
      "Pass --session <training_session_id> and/or --capture <capture_session_id>"
    );
  }

  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const captureIds = new Set(captures);

  for (const sessionId of sessions) {
    const { data: cap, error } = await db
      .from("capture_sessions")
      .select(
        "id, rider_id, horse_id, trainer_display_name, training_session_id, t0"
      )
      .eq("training_session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!cap?.id) {
      console.error(`No capture linked to training session ${sessionId}`);
      continue;
    }
    captureIds.add(cap.id);
  }

  for (const captureId of Array.from(captureIds)) {
    console.log(`\nPolishing capture ${captureId}…`);

    const { data: capture, error: capErr } = await db
      .from("capture_sessions")
      .select(
        "id, rider_id, horse_id, trainer_display_name, training_session_id, t0"
      )
      .eq("id", captureId)
      .maybeSingle();
    if (capErr) throw capErr;
    if (!capture?.training_session_id) {
      console.error("  skip — no training_session_id");
      continue;
    }

    const { data: segments, error: segErr } = await db
      .from("session_transcript_segments")
      .select("id, speaker, text, offset_ms, raw_json")
      .eq("capture_session_id", captureId)
      .order("offset_ms", { ascending: true });
    if (segErr) throw segErr;

    const list = (segments || []).map((s) => ({
      id: s.id as string,
      speaker: s.speaker as string,
      text: s.text as string,
      offset_ms: s.offset_ms as number,
      raw_json: (s.raw_json as Record<string, unknown> | null) || null,
    }));

    console.log(`  segments: ${list.length}`);

    let horseFocus: string | null = null;
    let horseName = "Horse";
    if (capture.horse_id) {
      const { data: horse } = await db
        .from("horse_profiles")
        .select("name, barn_name, current_focus")
        .eq("id", capture.horse_id)
        .maybeSingle();
      horseName = horse?.barn_name?.trim() || horse?.name || "Horse";
      horseFocus = horse?.current_focus ?? null;
    }

    const { cleaned, brief, usedClaude } = await cleanupTranscriptForJournal(
      list,
      {
        horseName,
        horseFocus,
        trainerName: capture.trainer_display_name,
        timeoutMs: 90000,
      }
    );

    const { data: existing } = await db
      .from("training_sessions")
      .select("summary, session_title")
      .eq("id", capture.training_session_id)
      .maybeSingle();
    const existingSummary = (existing?.summary as string) || "";
    const markStart = existingSummary.indexOf("<<<rider_highlights>>>");
    const markEnd = existingSummary.indexOf("<<<end_rider_highlights>>>");
    let riderBlock = "";
    if (markStart !== -1 && markEnd !== -1 && markEnd > markStart) {
      riderBlock = existingSummary.slice(
        markStart,
        markEnd + "<<<end_rider_highlights>>>".length
      );
    }

    if (!usedClaude || !brief) {
      const fallback = summarizeCaptureTranscript(list, {
        horseFocus,
        trainerName: capture.trainer_display_name,
        horseName,
        startedAt: capture.t0,
      });
      const nextSummary = fallback.focus
        ? `${fallback.focus}\n\n${fallback.summary}`
        : fallback.summary;
      const withMarks = riderBlock
        ? `${nextSummary.trim()}\n\n${riderBlock}`
        : nextSummary;
      await db
        .from("training_sessions")
        .update({
          session_title: fallback.title,
          summary: withMarks,
          homework: fallback.homework || null,
          exercises: fallback.exercises || null,
        })
        .eq("id", capture.training_session_id);
      console.log("  polished: false (fallback)", fallback.title);
      continue;
    }

    const toPersist = cleaned.filter((s) => s.id && s.raw_json);
    if (toPersist.length > 0) {
      await Promise.all(
        toPersist.map((s) =>
          db
            .from("session_transcript_segments")
            .update({ text: s.text, raw_json: s.raw_json })
            .eq("id", s.id!)
            .eq("capture_session_id", captureId)
        )
      );
    }

    const cardBody = buildCoachCardSummary({
      focus: brief.focus,
      story: brief.summary,
      corrections: brief.corrections,
      keeps: brief.keeps,
    });
    const withMarks = riderBlock
      ? `${cardBody.trim()}\n\n${riderBlock}`
      : cardBody;

    await db
      .from("training_sessions")
      .update({
        session_title: brief.title,
        summary: withMarks,
        homework: brief.homework,
        exercises: brief.exercises,
      })
      .eq("id", capture.training_session_id);

    console.log("  polished: true");
    console.log("  title:", brief.title);
    console.log("  theme:", brief.focus);
    console.log("  corrections:", brief.corrections.length);
    console.log("  keeps:", brief.keeps.length);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
