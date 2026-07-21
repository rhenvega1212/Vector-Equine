import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { SessionDeleteButton } from "@/components/train/session-delete-button";
import { DebriefShareActions } from "@/components/train/debrief-share-actions";
import { CoachingNotesEditor } from "@/components/train/coaching-notes-editor";
import { DebriefCaptureClient } from "@/components/train/debrief-capture-client";
import { DebriefJournalBrief } from "@/components/train/debrief-journal-brief";
import { VectorRideChatLazy } from "@/components/train/vector-ride-chat-lazy";
import { VECTOR_CONFIG } from "@/lib/vector/config";
import { cueReelFromSegments } from "@/lib/capture/summary";
import {
  formatSessionWhen,
  sessionDisplayTitle,
} from "@/lib/train/format-session-when";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

function splitFocusAndStory(summary: string | null): {
  focus: string | null;
  story: string | null;
} {
  if (!summary?.trim()) return { focus: null, story: null };
  const parts = summary.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0].length < 160) {
    return { focus: parts[0], story: parts.slice(1).join("\n\n") };
  }
  return { focus: null, story: summary.trim() };
}

export default async function DebriefPage({ params }: SessionPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session, error } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !session) notFound();

  const isOwner = session.user_id === user.id;

  const { data: riderProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", session.user_id)
    .single();
  const riderFirstName = (riderProfile?.display_name || "Rider").split(" ")[0];

  let horseShort = session.horse?.trim() || "Horse";
  if (session.horse_id) {
    const { data: horse } = await supabase
      .from("horse_profiles")
      .select("name")
      .eq("id", session.horse_id)
      .maybeSingle();
    if (horse?.name) horseShort = horse.name;
  }

  const { data: capture } = await supabase
    .from("capture_sessions")
    .select("id, trainer_display_name, t0")
    .eq("training_session_id", id)
    .maybeSingle();

  let timeline: {
    id: string;
    offset_ms: number;
    ended_offset_ms: number | null;
    speaker: string;
    text: string;
  }[] = [];
  if (capture?.id) {
    const { data: segments } = await supabase
      .from("session_transcript_segments")
      .select("id, offset_ms, ended_offset_ms, speaker, text")
      .eq("capture_session_id", capture.id)
      .order("offset_ms", { ascending: true });
    timeline = segments || [];
  }

  const trainerName =
    capture?.trainer_display_name ||
    (typeof session.notes === "string" && /^With\s+/i.test(session.notes)
      ? session.notes.replace(/^With\s+/i, "").trim()
      : null);

  const { focus, story } = splitFocusAndStory(session.summary);
  const cues = cueReelFromSegments(timeline);
  const source = session.session_source as string | null;
  const isComms = source === "comms" || (!source && !!capture);

  const backHref = isOwner ? "/train" : `/profile/coach/${session.user_id}`;
  const backLabel = isOwner ? "Today" : "Roster";

  const shareLine =
    focus || story?.split(".")[0]?.trim() || "Lesson notes from this ride.";

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="text-cream/70">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        </Link>
        {isOwner && (
          <div className="flex gap-2">
            {VECTOR_CONFIG.CAPTURE_LAB && capture?.id && (
              <Button
                variant="outline"
                size="sm"
                className="border-gold/30"
                asChild
              >
                <Link href={`/train/lab?capture=${capture.id}`}>Lab</Link>
              </Button>
            )}
            <SessionDeleteButton
              sessionId={session.id}
              sessionDate={session.session_date}
            />
            <Link href={`/train/sessions/${session.id}/edit`}>
              <Button variant="outline" size="sm" className="border-gold/30">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        )}
      </div>

      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
          Debrief
        </p>
        <h1 className="font-serif text-3xl text-cream sm:text-4xl">
          {sessionDisplayTitle(
            session.session_title,
            session.notes?.split(" — ")[0]?.trim() || "Today's ride"
          )}
        </h1>
        <p className="text-sm text-cream/55">
          {horseShort}
          {trainerName ? (
            <>
              {" "}
              · Lesson with{" "}
              <span className="text-cream/80">{trainerName}</span>
            </>
          ) : null}
        </p>
        <p className="text-sm text-cream/45">
          {formatSessionWhen(session.session_date, session.created_at)} ·{" "}
          {session.duration_minutes ?? "—"} min
          {source === "comms"
            ? " · comms"
            : source === "hybrid"
              ? " · hybrid"
              : ""}
        </p>
      </header>

      {capture ? (
        <DebriefCaptureClient
          sessionId={session.id}
          focus={focus}
          story={story}
          homework={isOwner ? session.homework : null}
          exercises={session.exercises}
          cues={cues}
          trainerName={trainerName}
          isComms={!!isComms}
          timeline={timeline}
          showChat={isOwner}
        />
      ) : (
        <div className="space-y-6">
          <DebriefJournalBrief
            focus={focus}
            story={story}
            homework={isOwner ? session.homework : null}
            exercises={session.exercises}
            cues={[]}
            trainerName={trainerName}
            isComms={false}
          />
          {isOwner && (
            <VectorRideChatLazy
              sessionId={session.id}
              trainerName={trainerName}
            />
          )}
        </div>
      )}

      {!isOwner && (
        <CoachingNotesEditor
          sessionId={session.id}
          initialSummary={session.summary}
          initialHomework={session.homework}
        />
      )}

      {isOwner && (
        <div className="flex flex-col gap-4">
          <DebriefShareActions
            score={session.overall_feel ?? 5}
            decodedLine={shareLine}
            horseName={horseShort}
            riderFirstName={riderFirstName}
            sessionId={session.id}
            isOwner
          />
          <Button variant="outline" className="border-gold/30 w-fit" asChild>
            <Link href="/train">Save to journal</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
