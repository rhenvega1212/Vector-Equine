import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Calendar, TrendingUp, Target } from "lucide-react";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";

export default async function TrainDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 30);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, session_date, overall_feel, horse, session_type")
    .eq("user_id", user.id)
    .order("session_date", { ascending: false });

  const list = sessions || [];
  const sessionsThisWeek = list.filter((s) => s.session_date >= weekStartStr).length;
  const sessionsThisMonth = list.filter((s) => s.session_date >= monthStartStr).length;

  const datesSet = new Set(list.map((s) => s.session_date));
  let currentStreak = 0;
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  for (;;) {
    const dStr = checkDate.toISOString().split("T")[0];
    if (datesSet.has(dStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }

  const last7 = list.filter((s) => s.session_date >= weekStartStr);
  const last30 = list.filter((s) => s.session_date >= monthStartStr);
  const avgFeel7 =
    last7.length > 0
      ? Math.round((last7.reduce((a, s) => a + s.overall_feel, 0) / last7.length) * 10) / 10
      : null;
  const avgFeel30 =
    last30.length > 0
      ? Math.round((last30.reduce((a, s) => a + s.overall_feel, 0) / last30.length) * 10) / 10
      : null;

  const { data: recentSessions } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Train</h1>
          <p className="text-muted-foreground">Your performance command center</p>
        </div>
        <Link href="/train/sessions/new">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black w-full sm:w-auto">
            Log a Session
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-cyan-400/20 bg-slate-800/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current streak
            </CardTitle>
            <Flame className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentStreak}</p>
            <p className="text-xs text-muted-foreground">days in a row</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-400/20 bg-slate-800/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This week
            </CardTitle>
            <Calendar className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sessionsThisWeek}</p>
            <p className="text-xs text-muted-foreground">sessions</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-400/20 bg-slate-800/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sessionsThisMonth}</p>
            <p className="text-xs text-muted-foreground">sessions</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-400/20 bg-slate-800/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Overall Feel
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {avgFeel7 != null ? `${avgFeel7}/10` : "—"} <span className="text-sm font-normal text-muted-foreground">(7d)</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {avgFeel30 != null ? `30d: ${avgFeel30}/10` : "No 30d data"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-cyan-400/20">
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <p className="text-sm text-muted-foreground">Last 5 sessions · tap to view details</p>
          </CardHeader>
          <CardContent>
            {(!recentSessions || recentSessions.length === 0) ? (
              <p className="text-muted-foreground py-8 text-center">
                No sessions yet. Log your first session to see it here.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentSessions.map((s: any) => (
                  <li key={s.id}>
                    <Link
                      href={`/train/sessions/${s.id}`}
                      className="flex items-center justify-between rounded-lg border border-cyan-400/10 bg-slate-800/30 p-3 hover:border-cyan-400/30 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {format(parseISO(s.session_date), "MMM d, yyyy")}
                        </span>
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
            {recentSessions && recentSessions.length > 0 && (
              <Link href="/train/sessions" className="mt-4 inline-block text-sm text-cyan-400 hover:text-cyan-300">
                View all sessions →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-400/20 bg-slate-800/30">
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="h-5 w-5 text-cyan-400" />
            <CardTitle>Suggested focus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Keep logging sessions to unlock personalized suggestions from Insights and AI Trainer.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
