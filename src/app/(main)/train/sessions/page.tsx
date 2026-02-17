import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { TrainSessionsFilters } from "@/components/train/sessions-filters";

interface SessionsPageProps {
  searchParams: Promise<{ range?: string; horse?: string; session_type?: string }> | { range?: string; horse?: string; session_type?: string };
}

export default async function TrainSessionsPage({ searchParams }: SessionsPageProps) {
  const resolved = await Promise.resolve(searchParams);
  const range = resolved.range || "30";
  const horse = resolved.horse || "";
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

  if (horse) query = query.eq("horse", horse);
  if (sessionType) query = query.eq("session_type", sessionType);

  const { data: sessions } = await query;

  const horses = await supabase
    .from("training_sessions")
    .select("horse")
    .eq("user_id", user.id);
  const horseList = Array.from(new Set((horses.data || []).map((r) => r.horse).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">View and manage your training sessions</p>
        </div>
        <Link href="/train/sessions/new">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Log Session
          </Button>
        </Link>
      </div>

      <TrainSessionsFilters
        currentRange={range}
        currentHorse={horse}
        currentSessionType={sessionType}
        horseList={horseList}
      />

      <Card className="border-cyan-400/20">
        <CardContent className="p-0">
          {(!sessions || sessions.length === 0) ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No sessions in this range.</p>
              <Link href="/train/sessions/new" className="mt-2 inline-block text-cyan-400 hover:text-cyan-300">
                Log your first session
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-cyan-400/10">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/train/sessions/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{format(parseISO(s.session_date), "MMM d, yyyy")}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{s.horse}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-cyan-400/90">
                        {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                      </span>
                    </div>
                    <span className="text-cyan-400 font-medium">{s.overall_feel}/10</span>
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
