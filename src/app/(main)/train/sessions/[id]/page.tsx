import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { SessionDeleteButton } from "@/components/train/session-delete-button";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

const SCORE_LABELS: Record<string, string> = {
  rhythm: "Rhythm",
  relaxation: "Relaxation",
  connection: "Connection",
  impulsion: "Impulsion",
  straightness: "Straightness",
  collection: "Collection",
};

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

  const scores = ["rhythm", "relaxation", "connection", "impulsion", "straightness", "collection"] as const;

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

      <Card className="border-cyan-400/20">
        <CardHeader>
          <CardTitle className="text-xl">
            {format(parseISO(session.session_date), "EEEE, MMMM d, yyyy")}
          </CardTitle>
          <p className="text-muted-foreground">
            {session.horse} · {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Overall Feel</h3>
            <p className="text-2xl font-bold text-cyan-400">{session.overall_feel}/10</p>
          </div>

          {(session.rhythm ?? session.relaxation ?? session.connection ?? session.impulsion ?? session.straightness ?? session.collection) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Performance scores (1–5)</h3>
              <div className="flex flex-wrap gap-4">
                {scores.map((key) => {
                  const v = session[key];
                  if (v == null) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{SCORE_LABELS[key]}:</span>
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
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Notes / Reflections</h3>
              <p className="whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {session.competition_prep && (
              <span className="rounded-md bg-cyan-400/20 px-2 py-1 text-xs text-cyan-400">Competition prep</span>
            )}
            {session.focused_goal_session && (
              <span className="rounded-md bg-cyan-400/20 px-2 py-1 text-xs text-cyan-400">Focused goal session</span>
            )}
          </div>

          {session.video_link_url && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Video</h3>
              <a
                href={session.video_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                View video
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
