import { createClient } from "@/lib/supabase/server";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { RidesListClient } from "@/components/train/rides-list-client";
import { sessionDisplayTitle } from "@/lib/train/format-session-when";
import { formatHomeCalendarDate } from "@/lib/timezone";
import { getCurrentProfile } from "@/lib/auth/current-profile";

interface SessionsPageProps {
  searchParams:
    | Promise<{ horseId?: string; horse_id?: string }>
    | { horseId?: string; horse_id?: string };
}

export default async function TrainSessionsPage({
  searchParams,
}: SessionsPageProps) {
  const resolved = await Promise.resolve(searchParams);
  const horseIdParam = resolved.horseId || resolved.horse_id || "";

  const { user, profile } = await getCurrentProfile();
  if (!user) return null;
  const supabase = await createClient();
  const showTest = profile?.role === "admin";

  const { data: horseProfiles } = await supabase
    .from("horse_profiles")
    .select("id, name, barn_name")
    .eq("user_id", user.id)
    .order("name");

  const horses = horseProfiles || [];
  const activeHorse =
    horses.find((h) => h.id === horseIdParam) || horses[0] || null;

  let query = supabase
    .from("training_sessions")
    .select(
      "id, session_date, created_at, session_title, session_type, duration_minutes, horse, horse_id, notes, session_source, is_test"
    )
    .eq("user_id", user.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (!showTest) {
    query = query.eq("is_test", false);
  }

  if (activeHorse) {
    query = query.eq("horse_id", activeHorse.id);
  }

  const { data: sessions } = await query;
  const list = sessions || [];

  const trainerBySession = new Map<string, string>();
  if (list.length > 0) {
    const { data: captures } = await supabase
      .from("capture_sessions")
      .select("training_session_id, trainer_display_name")
      .in(
        "training_session_id",
        list.map((s) => s.id)
      );
    for (const c of captures || []) {
      if (c.training_session_id && c.trainer_display_name?.trim()) {
        trainerBySession.set(
          c.training_session_id,
          c.trainer_display_name.trim()
        );
      }
    }
  }

  const horseLabel = activeHorse
    ? activeHorse.barn_name?.trim() || activeHorse.name
    : "All";

  const rides = list.map((s) => {
    const trainer =
      trainerBySession.get(s.id) ||
      (typeof s.notes === "string" && /^With\s+/i.test(s.notes)
        ? s.notes.replace(/^With\s+/i, "").trim()
        : null);
    const isLesson =
      s.session_source === "comms" ||
      s.session_source === "hybrid" ||
      !!trainer;
    const datePart = formatHomeCalendarDate(s.session_date, "MMM d").toUpperCase();
    const metaParts = [datePart];
    if ((s as { is_test?: boolean }).is_test) metaParts.push("TEST");
    if (isLesson) {
      metaParts.push("LESSON");
      if (trainer) metaParts.push(trainer.toUpperCase());
    } else {
      metaParts.push("SCHOOLING");
    }
    const title = sessionDisplayTitle(
      s.session_title,
      s.notes?.split(" — ")[0]?.trim() ||
        SESSION_TYPE_LABELS[s.session_type] ||
        s.session_type
    );
    return {
      id: s.id,
      title,
      meta: metaParts.join(" · "),
      searchText: title,
      session_date: s.session_date,
      sensorValue: null as string | null,
    };
  });

  return <RidesListClient horseLabel={horseLabel} rides={rides} />;
}
