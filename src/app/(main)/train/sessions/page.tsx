import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { TrainSessionsFilters } from "@/components/train/sessions-filters";

interface SessionsPageProps {
  searchParams: Promise<{ range?: string; horse?: string; horse_id?: string; session_type?: string }> | { range?: string; horse?: string; horse_id?: string; session_type?: string };
}

export default async function TrainSessionsPage({ searchParams }: SessionsPageProps) {
  const resolved = await Promise.resolve(searchParams);
  const range = resolved.range || "30";
  const horse = resolved.horse || "";
  const horseId = resolved.horse_id || "";
  const sessionType = resolved.session_type || "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const fromDate = new Date();
  if (range === "7") fromDate.setDate(fromDate.getDate() - 7);
  else if (range === "30") fromDate.setDate(fromDate.getDate() - 30);
  else fromDate.setDate(fromDate.getDate() - 90);
  const fromStr = fromDate.toISOString().split("T")[0];

  let query = supabase
    .from("training_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("session_date", fromStr)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (horseId) query = query.eq("horse_id", horseId);
  else if (horse) query = query.eq("horse", horse);
  if (sessionType) query = query.eq("session_type", sessionType);

  const { data: sessions } = await query;

  const { data: horseProfiles } = await supabase
    .from("horse_profiles")
    .select("id, name, barn_name")
    .eq("user_id", user.id)
    .order("name");

  const horseMap = new Map((horseProfiles || []).map((h) => [h.id, h]));
  function horseDisplay(s: { horse_id?: string | null; horse?: string | null }) {
    if (s.horse_id) {
      const hp = horseMap.get(s.horse_id);
      return hp ? (hp.barn_name?.trim() ? `${hp.name} (“${hp.barn_name}”)` : hp.name) : "Unassigned";
    }
    return (s.horse && s.horse.trim()) || "Unassigned";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">History</p>
          <h1 className="mt-1 font-serif text-3xl">Sessions</h1>
          <p className="text-cream/60">View and manage your training sessions</p>
        </div>
        <Link href="/train/sessions/new">
          <Button className="bg-gold text-navy font-semibold hover:bg-gold/90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Log Session
          </Button>
        </Link>
      </div>

      <TrainSessionsFilters
        currentRange={range}
        currentHorseId={horseId}
        currentSessionType={sessionType}
        horseProfiles={horseProfiles || []}
      />

      <Card className="border-gold/20 bg-white/5">
        <CardContent className="p-0">
          {(!sessions || sessions.length === 0) ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No sessions in this range.</p>
              <Link href="/train/sessions/new" className="mt-2 inline-block text-gold hover:text-gold-bright">
                Log your first session
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gold/10">
              {sessions.map((s: { id: string; session_date: string; session_title?: string | null; session_type: string; duration_minutes?: number | null; overall_feel: number; horse?: string | null; horse_id?: string | null; video_link_url?: string | null; video_upload_path?: string | null }) => (
                <li key={s.id}>
                  <Link
                    href={`/train/sessions/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{format(parseISO(s.session_date), "MMM d, yyyy")}</span>
                      {s.session_title && <span className="text-muted-foreground">·</span>}
                      {s.session_title && <span className="text-foreground">{s.session_title}</span>}
                      <span className="text-muted-foreground">·</span>
                      <span>{horseDisplay(s)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-gold/90">
                        {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                      </span>
                      {s.duration_minutes != null && <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {(s.video_link_url || s.video_upload_path) && <span className="text-xs text-muted-foreground">Video</span>}
                      <span className="text-gold font-medium">{s.overall_feel}/10</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
