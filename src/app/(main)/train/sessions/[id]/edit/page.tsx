import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionForm } from "@/components/train/session-form";

interface EditSessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSessionPage({ params }: EditSessionPageProps) {
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

  const defaultValues = {
    session_date: session.session_date,
    horse: session.horse,
    session_type: session.session_type,
    overall_feel: session.overall_feel,
    discipline: session.discipline ?? undefined,
    exercises: session.exercises ?? undefined,
    notes: session.notes ?? undefined,
    rhythm: session.rhythm ?? undefined,
    relaxation: session.relaxation ?? undefined,
    connection: session.connection ?? undefined,
    impulsion: session.impulsion ?? undefined,
    straightness: session.straightness ?? undefined,
    collection: session.collection ?? undefined,
    competition_prep: session.competition_prep ?? false,
    focused_goal_session: session.focused_goal_session ?? false,
    video_link_url: session.video_link_url ?? undefined,
  };

  return (
    <div>
      <SessionForm mode="edit" sessionId={id} defaultValues={defaultValues} />
    </div>
  );
}
