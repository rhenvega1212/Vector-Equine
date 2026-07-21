import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { SessionDeleteButton } from "@/components/train/session-delete-button";
import { DebriefShareActions } from "@/components/train/debrief-share-actions";
import { CoachingNotesEditor } from "@/components/train/coaching-notes-editor";
import {
  DebriefCaptureTabs,
  type TimelineSegment,
} from "@/components/train/debrief-capture-tabs";
import { VECTOR_CONFIG } from "@/lib/vector/config";
import {
  formatSessionWhen,
  sessionDisplayTitle,
} from "@/lib/train/format-session-when";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

const LEGACY_SCORES = [
  "rhythm",
  "relaxation",
  "connection",
  "impulsion",
  "straightness",
  "collection",
] as const;

const DECODED_MOMENTS = [
  {
    t: "0:04",
    kind: "watch" as const,
    text: "Right seatbone released 0.4s late on entry — that's the drift out.",
  },
  {
    t: "0:11",
    kind: "good" as const,
    text: "Left leg held steady through the turn — that's the sit.",
  },
  {
    t: "0:19",
    kind: "watch" as const,
    text: "Right rein got heavy — he lost the jump for a stride.",
  },
];

const AID_GRID = [
  { name: "R Seat", note: "release: late" },
  { name: "L Seat", note: "steady ✓" },
  { name: "R Rein", note: "pressure: heavy" },
  { name: "L Rein", note: "soft ✓" },
  { name: "R Leg", note: "timing: ok" },
  { name: "L Leg", note: "steady ✓" },
];

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

  let timeline: TimelineSegment[] = [];
  if (capture?.id) {
    const { data: segments } = await supabase
      .from("session_transcript_segments")
      .select("id, offset_ms, ended_offset_ms, speaker, text")
      .eq("capture_session_id", capture.id)
      .order("offset_ms", { ascending: true });
    timeline = (segments || []) as TimelineSegment[];
  }

  const score =
    session.overall_feel >= 10 ? 6.5 : Math.min(9.9, session.overall_feel + 0.5);
  const italic = session.summary?.split(".")[0]?.trim() || "Closer than it felt.";

  const source = session.session_source as string | null;
  const showDecoded = source === "sensor" || source === "hybrid";

  const backHref = isOwner ? "/train" : `/profile/coach/${session.user_id}`;
  const backLabel = isOwner ? "Today" : "Roster";
  const planHref = session.horse_id
    ? `/train/ride/plan?horseId=${session.horse_id}`
    : "/train/ride/plan";

  const journalBody = (
    <div className="space-y-8">
      <section className="rounded-xl border border-gold/20 bg-[#131C31] p-6">
        <div className="flex items-end gap-4">
          <p className="font-serif text-6xl text-gold-bright">{score.toFixed(1)}</p>
          <div className="pb-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cream/50">
              Execution
            </p>
            <p className="text-xs text-cream/40">Feel score from this ride</p>
          </div>
        </div>
        <p className="mt-4 font-serif text-lg italic text-gold">{italic}</p>
      </section>

      {session.summary?.trim() && (
        <section className="rounded-xl border border-gold/15 bg-[#131C31] p-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Session summary
          </p>
          <p className="text-sm leading-relaxed text-cream/85">{session.summary}</p>
        </section>
      )}

      {session.exercises?.trim() && (
        <section className="rounded-xl border border-gold/15 bg-[#131C31] p-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Key exercises & phrases
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-cream/85">
            {session.exercises}
          </p>
        </section>
      )}

      {capture?.trainer_display_name && (
        <p className="text-xs text-cream/45">
          Guest trainer: {capture.trainer_display_name}
        </p>
      )}

      {showDecoded && (
        <>
          <section className="space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Your ride, decoded
            </h2>
            <div className="overflow-hidden rounded-xl border border-gold/15 bg-navy">
              <div className="flex h-40 items-center justify-center bg-gradient-to-b from-[#1A2440] to-navy">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">
                  ▶
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {DECODED_MOMENTS.map((m) => (
                <li
                  key={m.t}
                  className="rounded-lg border border-gold/10 bg-[#131C31] px-3 py-3 text-sm"
                >
                  <span
                    className={`mr-2 text-[10px] font-semibold uppercase tracking-wider ${
                      m.kind === "good" ? "text-[#7FB08A]" : "text-[#C98A5A]"
                    }`}
                  >
                    {m.t} · {m.kind}
                  </span>
                  <p className="mt-1 text-cream/85">{m.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Aid effectiveness
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AID_GRID.map((a) => (
                <div
                  key={a.name}
                  className="rounded-lg border border-gold/10 bg-[#131C31] px-3 py-2"
                >
                  <p className="text-xs font-medium text-cream">{a.name}</p>
                  <p className="text-[11px] text-cream/50">{a.note}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Training scale
        </h2>
        <p className="text-xs text-cream/40">Suggested from your ride — adjust anytime.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {LEGACY_SCORES.map((key) => {
            const v = (session[key] as number | null) ?? 3;
            return (
              <div key={key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize text-cream/60">{key}</span>
                  <span className="text-cream">{v}/5</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#1A2440]">
                  <div className="h-full bg-gold" style={{ width: `${(v / 5) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-sm text-[#7FB08A]">
        Trunk symmetry looked even today. ✓ — a calm flag, not a diagnosis.
      </p>

      {isOwner && session.homework && (
        <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cream/50">Homework</p>
          <p className="mt-2 text-sm text-cream/85">{session.homework}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
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
              <Button variant="outline" size="sm" className="border-gold/30" asChild>
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

      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
          Debrief
        </p>
        <h1 className="font-serif text-3xl text-cream">
          {sessionDisplayTitle(
            session.session_title,
            session.notes?.split(" — ")[0]?.trim() || "Today's ride"
          )}
        </h1>
        <p className="text-sm text-cream/50">
          {horseShort} ·{" "}
          {formatSessionWhen(session.session_date, session.created_at)} ·{" "}
          {session.duration_minutes ?? "—"} min
          {source === "comms" ? " · comms" : source === "hybrid" ? " · hybrid" : ""}
        </p>
      </header>

      {capture ? (
        <DebriefCaptureTabs journal={journalBody} timeline={timeline} />
      ) : (
        journalBody
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
            score={Math.round(score)}
            decodedLine={italic}
            horseName={horseShort}
            riderFirstName={riderFirstName}
            sessionId={session.id}
            isOwner
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-gold/30" asChild>
              <Link href="/train">Save to journal</Link>
            </Button>
            <Button className="bg-gold text-navy font-semibold hover:bg-gold-bright" asChild>
              <Link href={planHref}>Ask Vector about this ride</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
