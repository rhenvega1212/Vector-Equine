import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AskVectorRoom } from "@/components/train/ask-vector-room";
import { sessionDisplayTitle } from "@/lib/train/format-session-when";
import { formatHomeCalendarDate } from "@/lib/timezone";
import { buildAskExamples } from "@/lib/ask/examples";
import { deriveRideMoments } from "@/lib/train/ride-moments";
import { readCleanedTranscript } from "@/lib/capture/transcript-read";
import type { AskTurn } from "@/lib/ask/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AskVectorPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session, error } = await supabase
    .from("training_sessions")
    .select(
      "id, user_id, session_date, session_title, summary, homework, notes, horse_id, horse"
    )
    .eq("id", id)
    .single();

  if (error || !session || session.user_id !== user.id) notFound();

  const title = sessionDisplayTitle(session.session_title, "Lesson");
  const datePart = formatHomeCalendarDate(
    session.session_date,
    "MMM d"
  ).toUpperCase();
  const contextLabel = `${datePart} · ${title}`.toUpperCase();

  const { data: capture } = await supabase
    .from("capture_sessions")
    .select("id, trainer_display_name")
    .eq("training_session_id", id)
    .maybeSingle();

  let timeline: {
    offset_ms: number;
    speaker: string;
    text: string;
    rider_highlight?: boolean;
    featured_quote?: boolean;
  }[] = [];

  if (capture?.id) {
    const { data: segments } = await readCleanedTranscript(supabase, capture.id);
    timeline = segments.map((s) => {
      const raw = (s.raw_json || {}) as Record<string, unknown>;
      return {
        offset_ms: s.offset_ms,
        speaker: s.speaker,
        text: s.text,
        rider_highlight: !!raw.rider_highlight,
        featured_quote: !!raw.featured_quote,
      };
    });
  }

  const { moments } = deriveRideMoments({
    summary: session.summary,
    timeline,
    trainerName: capture?.trainer_display_name,
  });

  const examples = buildAskExamples({
    title,
    moments,
    homework: session.homework,
  });

  const { data: turnRows } = await supabase
    .from("session_ask_turns")
    .select("id, question, answer, asked_by_voice, sources, created_at")
    .eq("training_session_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const initialTurns: AskTurn[] = (turnRows || []).map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    askedByVoice: !!row.asked_by_voice,
    sources: Array.isArray(row.sources) ? row.sources : [],
    createdAt: row.created_at,
  }));

  const backHref = `/train/sessions/${id}`;

  return (
    <AskVectorRoom
      sessionId={id}
      backHref={backHref}
      contextLabel={contextLabel}
      examples={examples}
      initialTurns={initialTurns}
    />
  );
}
