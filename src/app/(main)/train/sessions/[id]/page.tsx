import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Pencil, Video } from "lucide-react";
import { SessionDeleteButton } from "@/components/train/session-delete-button";
import { DebriefShareActions } from "@/components/train/debrief-share-actions";

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
    .eq("user_id", user.id)
    .single();

  if (error || !session) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const riderFirstName = (profile?.display_name || "Rider").split(" ")[0];

  let horseDisplay: string;
  let horseShort = "Horse";
  if (session.horse_id) {
    const { data: horse } = await supabase
      .from("horse_profiles")
      .select("name, barn_name")
      .eq("id", session.horse_id)
      .eq("user_id", user.id)
      .single();
    horseDisplay = horse
      ? horse.barn_name?.trim()
        ? `${horse.name} (“${horse.barn_name}”)`
        : horse.name
      : "Unassigned";
    horseShort = horse?.name || "Horse";
  } else {
    horseDisplay = (session.horse && session.horse.trim()) || "Unassigned";
    horseShort = horseDisplay;
  }

  let videoUrl: string | null = null;
  if (session.video_upload_path) {
    const { data: signed } = await supabase.storage
      .from("session-videos")
      .createSignedUrl(session.video_upload_path, 3600);
    videoUrl = signed?.signedUrl ?? null;
  }

  const decodedLine =
    session.summary?.trim() ||
    "Your ride, decoded — feel and timing notes land here after each session.";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/train">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Today
          </Button>
        </Link>
        <div className="flex gap-2">
          <SessionDeleteButton sessionId={session.id} sessionDate={session.session_date} />
          <Link href={`/train/sessions/${session.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Debrief</p>
        <h1 className="font-serif text-3xl sm:text-4xl">
          {session.session_title?.trim() ||
            format(parseISO(session.session_date), "EEEE, MMMM d")}
        </h1>
        <p className="text-muted-foreground">
          {format(parseISO(session.session_date), "MMM d, yyyy")} · {horseDisplay} ·{" "}
          {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
          {session.session_source && session.session_source !== "manual"
            ? ` · ${session.session_source}`
            : ""}
        </p>
      </header>

      <section className="rounded-xl border border-gold/25 bg-navy p-6 text-cream">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cream/50">Execution score</p>
        <p className="mt-2 font-serif text-5xl text-gold">{session.overall_feel}</p>
        <p className="mt-3 font-serif text-lg italic text-gold-bright">{decodedLine}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Your ride, decoded
        </h2>
        {(session.video_link_url || videoUrl) && (
          <div className="overflow-hidden rounded-xl border border-gold/20">
            {session.video_link_url ? (
              <a
                href={session.video_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-muted/40 p-4 text-gold hover:text-gold-bright"
              >
                <Video className="h-4 w-4" /> View ride video
              </a>
            ) : videoUrl ? (
              <video src={videoUrl} controls className="w-full max-h-80 bg-black" />
            ) : null}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {session.exercises?.trim() ||
            "Decoded moments appear here when sensor data exists; otherwise your coach summary fills this space."}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gold/20 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Session summary
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {session.summary?.trim() || session.notes?.trim() || "No summary yet."}
          </p>
        </div>
        <div className="rounded-xl border border-gold/20 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Homework
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {session.homework?.trim() ||
              "Homework from your coach will land here. Works alongside your trainer."}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Training scale
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LEGACY_SCORES.map((key) => {
            const v = session[key] as number | null;
            const pct = v != null ? (v / 5) * 100 : 0;
            return (
              <div key={key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{key}</span>
                  <span className="font-medium">{v != null ? `${v}/5` : "—"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Health: symmetry looking settled — no watch note. Flags only, never a diagnosis.
      </p>

      <div className="flex flex-wrap gap-3">
        <DebriefShareActions
          score={session.overall_feel}
          decodedLine={decodedLine}
          horseName={horseShort}
          riderFirstName={riderFirstName}
        />
        <Button variant="outline" asChild>
          <Link href="/train">Save to journal</Link>
        </Button>
        <Button className="bg-gold text-navy font-semibold hover:bg-gold-bright" asChild>
          <Link href="/train/ride/plan">Ask Vector about this ride</Link>
        </Button>
      </div>
    </div>
  );
}
