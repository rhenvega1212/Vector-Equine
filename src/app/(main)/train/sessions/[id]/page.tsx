import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { isFlagEnabled } from "@/lib/flags/server";
import { Pencil } from "lucide-react";
import { SessionDeleteButton } from "@/components/train/session-delete-button";
import { DebriefShareActions } from "@/components/train/debrief-share-actions";
import { RideFeelAsk } from "@/components/train/ride-feel-ask";
import { CoachingNotesEditor } from "@/components/train/coaching-notes-editor";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";
import { RideDetailClient } from "@/components/train/ride-detail-client";
import { BriefPendingRefresh } from "@/components/train/brief-pending-refresh";
import { VECTOR_CONFIG } from "@/lib/vector/config";
import { sessionDisplayTitle } from "@/lib/train/format-session-when";
import {
  formatHomeCalendarDate,
  formatInHomeTz,
} from "@/lib/timezone";
import {
  deriveRideMoments,
  transcriptFromTimeline,
} from "@/lib/train/ride-moments";
import {
  isBriefPending,
  parseCoachCardSummary,
} from "@/lib/capture/transcript-cleanup";
import { resolveRideVideo } from "@/lib/capture/resolve-ride-video";
import {
  readCleanedTranscript,
  type TranscriptRow,
} from "@/lib/capture/transcript-read";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function RidePage({ params }: SessionPageProps) {
  const { id } = await params;
  const [{ user, profile }, supabase] = await Promise.all([
    getCurrentProfile(),
    createClient(),
  ]);
  if (!user) return null;

  const { data: session, error } = await supabase
    .from("training_sessions")
    .select(
      "id, user_id, horse_id, horse, session_date, created_at, session_title, session_source, duration_minutes, notes, summary, homework, overall_feel, video_link_url"
    )
    .eq("id", id)
    .single();

  if (error || !session) notFound();

  const isOwner = session.user_id === user.id;

  // Fan out independent lookups — was a 4–5 deep waterfall before
  const [riderProfileRes, horseRes, captureRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user_id)
      .maybeSingle(),
    session.horse_id
      ? supabase
          .from("horse_profiles")
          .select("name, barn_name")
          .eq("id", session.horse_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string; barn_name: string | null } | null }),
    supabase
      .from("capture_sessions")
      .select("id, trainer_display_name, t0, join_code")
      .eq("training_session_id", id)
      .maybeSingle(),
  ]);

  const riderFirstName = (
    riderProfileRes.data?.display_name || "Rider"
  ).split(" ")[0];

  const horse = horseRes.data;
  const horseShort =
    horse?.barn_name?.trim() ||
    horse?.name ||
    session.horse?.trim() ||
    "Horse";

  const capture = captureRes.data;

  const [segmentsRes, rideVideo] = await Promise.all([
    capture?.id
      ? readCleanedTranscript(supabase, capture.id, { limit: 400 })
      : Promise.resolve({ data: [] as TranscriptRow[] }),
    resolveRideVideo({
      captureSessionId: capture?.id,
      videoLinkUrl: session.video_link_url,
      riderId: session.user_id,
    }),
  ]);

  const timeline = segmentsRes.data.map((s) => {
    const raw = (s.raw_json || {}) as Record<string, unknown>;
    return {
      id: s.id,
      offset_ms: s.offset_ms,
      ended_offset_ms: s.ended_offset_ms,
      speaker: s.speaker,
      text: s.text,
      rider_highlight: !!raw.rider_highlight,
      featured_quote: !!raw.featured_quote,
    };
  });

  const trainerName =
    capture?.trainer_display_name ||
    (typeof session.notes === "string" && /^With\s+/i.test(session.notes)
      ? session.notes.replace(/^With\s+/i, "").trim()
      : null);
  const trainerFirst = trainerName?.trim().split(/\s+/)[0] || null;

  const riderNoteRaw = session.notes?.trim() || null;
  const riderNote =
    riderNoteRaw && !/^With\s+/i.test(riderNoteRaw)
      ? riderNoteRaw.replace(/^[^—–-]+[—–-]\s*/, "").trim() || riderNoteRaw
      : null;

  const { moments, carryIn } = deriveRideMoments({
    summary: session.summary,
    timeline,
    trainerName,
    riderNote,
  });

  const parsedCard = parseCoachCardSummary(session.summary);
  const briefPending = isBriefPending(session.summary);
  const storyParagraphs =
    !briefPending && moments.length === 0 && parsedCard.story
      ? parsedCard.story
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

  const transcript = transcriptFromTimeline(timeline, trainerName);

  const title = sessionDisplayTitle(session.session_title, "Lesson");

  const datePart = formatHomeCalendarDate(
    session.session_date,
    "MMM d"
  ).toUpperCase();
  const timePart = session.created_at
    ? formatInHomeTz(session.created_at, "h:mm a").toUpperCase()
    : null;
  const dur =
    session.duration_minutes != null
      ? `${session.duration_minutes} MIN`
      : null;
  const metaLine = [datePart, timePart, dur].filter(Boolean).join(" · ");

  const isLesson =
    session.session_source === "comms" ||
    session.session_source === "hybrid" ||
    !!trainerName;
  const whoLine = trainerName
    ? `${horseShort} · Lesson with ${trainerName}`
    : `${horseShort} · ${isLesson ? "Lesson" : "Schooling"}`;

  const backHref = isOwner
    ? session.horse_id
      ? `/train/sessions?range=all&horseId=${session.horse_id}`
      : "/train/sessions?range=all"
    : `/profile/coach/${session.user_id}`;

  const planHref = (await isFlagEnabled("video_analysis", profile))
    ? session.horse_id
      ? `/train/ride/plan?horseId=${session.horse_id}`
      : "/train/ride/plan"
    : null;

  const shareLine =
    carryIn?.text || moments[0]?.text || "Lesson notes from this ride.";

  const tools = (
    <>
      {isOwner && (
        <div className="flex flex-wrap gap-3">
          {VECTOR_CONFIG.CAPTURE_LAB && capture?.id ? (
            <Link
              href={`/train/lab?capture=${capture.id}`}
              className="text-[12.5px] text-cream-dim hover:text-gold"
            >
              Lab
            </Link>
          ) : null}
          <Link
            href={`/train/sessions/${session.id}/edit`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-cream-dim hover:text-gold"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <SessionDeleteButton
            sessionId={session.id}
            sessionDate={session.session_date}
          />
        </div>
      )}
      {isOwner && (
        <DebriefShareActions
          score={session.overall_feel}
          decodedLine={shareLine}
          horseName={horseShort}
          riderFirstName={riderFirstName}
          sessionId={session.id}
          isOwner
        />
      )}
      {!isOwner && (
        <CoachingNotesEditor
          sessionId={session.id}
          initialSummary={session.summary}
          initialHomework={session.homework}
        />
      )}
    </>
  );

  const feelAsk =
    isOwner && session.overall_feel == null ? (
      <RideFeelAsk
        rideId={session.id}
        withTrainer={Boolean(trainerFirst)}
        horseName={horseShort}
        title={title}
        whenLabel={metaLine}
        joinCode={capture?.join_code ?? null}
      />
    ) : null;

  return (
    <AtmosphereScreen className="min-h-[70vh] -mx-3 sm:-mx-4">
      <BriefPendingRefresh sessionId={session.id} pending={briefPending} />
      <RideDetailClient
        backHref={backHref}
        metaLine={metaLine}
        title={title}
        whoLine={whoLine}
        feelAsk={feelAsk}
        carryIn={briefPending ? null : carryIn}
        moments={briefPending ? [] : moments}
        storyParagraphs={storyParagraphs}
        transcript={transcript}
        trainerFirstName={trainerFirst}
        riderNote={riderNote}
        videoUrl={rideVideo.url}
        videoKind={rideVideo.kind}
        videoSyncOffsetMs={rideVideo.syncOffsetMs}
        planHref={planHref}
        askHref={`/train/sessions/${session.id}/ask`}
        tools={tools}
      />
    </AtmosphereScreen>
  );
}
