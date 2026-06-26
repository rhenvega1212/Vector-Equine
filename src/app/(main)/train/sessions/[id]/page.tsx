import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_TYPE_LABELS, QUICK_RATING_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Pencil, Trash2, Video } from "lucide-react";
import { SessionDeleteButton } from "@/components/train/session-delete-button";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

const QUICK_RATING_KEYS = [
  "ride_quality", "horse_energy", "relaxation", "responsiveness", "connection",
  "straightness", "balance", "suppleness", "rider_position", "rider_effectiveness",
  "focus", "confidence", "progress_today", "soundness", "stamina", "behavior_attitude",
] as const;

const LEGACY_SCORES = ["rhythm", "relaxation", "connection", "impulsion", "straightness", "collection"] as const;

export default async function TrainSessionDetailPage({ params }: SessionPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session, error } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) notFound();

  let horseDisplay: string;
  if (session.horse_id) {
    const { data: horse } = await supabase
      .from("horse_profiles")
      .select("name, barn_name")
      .eq("id", session.horse_id)
      .eq("user_id", user.id)
      .single();
    horseDisplay = horse
      ? (horse.barn_name?.trim() ? `${horse.name} (“${horse.barn_name}”)` : horse.name)
      : "Unassigned";
  } else {
    horseDisplay = (session.horse && session.horse.trim()) || "Unassigned";
  }

  let videoUrl: string | null = null;
  if (session.video_upload_path) {
    const { data: signed } = await supabase.storage
      .from("session-videos")
      .createSignedUrl(session.video_upload_path, 3600);
    videoUrl = signed?.signedUrl ?? null;
  }

  const hasQuickRatings = QUICK_RATING_KEYS.some((k) => session[k] != null);
  const hasLegacyScores = LEGACY_SCORES.some((k) => session[k] != null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/train/sessions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>
        </Link>
        <div className="flex gap-2">
          <SessionDeleteButton sessionId={session.id} sessionDate={session.session_date} />
          <Link href={`/train/sessions/${session.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-gold/20">
        <CardHeader>
          <CardTitle className="text-xl">
            {session.session_title?.trim() || format(parseISO(session.session_date), "EEEE, MMMM d, yyyy")}
          </CardTitle>
          <p className="text-muted-foreground">
            {format(parseISO(session.session_date), "MMM d, yyyy")} · {horseDisplay} · {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
            {session.duration_minutes != null && ` · ${session.duration_minutes} min`}
            {session.location?.trim() && ` · ${session.location}`}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Overall feel</h3>
            <p className="text-2xl font-bold text-gold">{session.overall_feel}/10</p>
          </div>

          {(hasQuickRatings || hasLegacyScores) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Ratings (1–5)</h3>
              <div className="flex flex-wrap gap-3">
                {QUICK_RATING_KEYS.map((key) => {
                  const v = session[key];
                  if (v == null) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{QUICK_RATING_LABELS[key]}:</span>
                      <span className="font-medium">{v}/5</span>
                    </div>
                  );
                })}
                {LEGACY_SCORES.map((key) => {
                  const v = session[key];
                  if (v == null) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                      <span className="font-medium">{v}/5</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {session.discipline && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Discipline</h3>
              <p>{session.discipline}</p>
            </div>
          )}

          {session.exercises && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Exercises</h3>
              <p className="whitespace-pre-wrap">{session.exercises}</p>
            </div>
          )}

          {session.notes && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Journal</h3>
              <p className="whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {session.competition_prep && (
              <span className="rounded-md bg-gold/20 px-2 py-1 text-xs text-gold">Competition prep</span>
            )}
            {session.focused_goal_session && (
              <span className="rounded-md bg-gold/20 px-2 py-1 text-xs text-gold">Focused goal session</span>
            )}
          </div>

          {(session.video_link_url || videoUrl) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Video className="h-4 w-4" /> Video
              </h3>
              {session.video_link_url ? (
                <a
                  href={session.video_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:text-gold-bright underline"
                >
                  View video
                </a>
              ) : videoUrl ? (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:text-gold-bright underline"
                >
                  View uploaded video
                </a>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
