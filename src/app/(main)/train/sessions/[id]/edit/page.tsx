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
    horse_id: session.horse_id ?? undefined,
    horse: session.horse ?? undefined,
    session_title: session.session_title ?? undefined,
    session_type: session.session_type,
    duration_minutes: session.duration_minutes ?? undefined,
    location: session.location ?? undefined,
    overall_feel: session.overall_feel ?? 3,
    feel_scale: (session as { feel_scale?: 5 | 10 | null }).feel_scale ?? null,
    discipline: session.discipline ?? undefined,
    exercises: session.exercises ?? undefined,
    notes: session.notes ?? undefined,
    rhythm: session.rhythm ?? undefined,
    relaxation: session.relaxation ?? undefined,
    connection: session.connection ?? undefined,
    impulsion: session.impulsion ?? undefined,
    straightness: session.straightness ?? undefined,
    collection: session.collection ?? undefined,
    ride_quality: session.ride_quality ?? undefined,
    horse_energy: session.horse_energy ?? undefined,
    responsiveness: session.responsiveness ?? undefined,
    balance: session.balance ?? undefined,
    suppleness: session.suppleness ?? undefined,
    rider_position: session.rider_position ?? undefined,
    rider_effectiveness: session.rider_effectiveness ?? undefined,
    focus: session.focus ?? undefined,
    confidence: session.confidence ?? undefined,
    progress_today: session.progress_today ?? undefined,
    soundness: session.soundness ?? undefined,
    stamina: session.stamina ?? undefined,
    behavior_attitude: session.behavior_attitude ?? undefined,
    competition_prep: session.competition_prep ?? false,
    focused_goal_session: session.focused_goal_session ?? false,
    video_link_url: session.video_link_url ?? undefined,
    video_upload_path: session.video_upload_path ?? undefined,
  };

  return (
    <div>
      <SessionForm mode="edit" sessionId={id} defaultValues={defaultValues} />
    </div>
  );
}
