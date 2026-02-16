import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Calendar } from "lucide-react";
import { subDays } from "date-fns";

const SCORE_KEYS = ["rhythm", "relaxation", "connection", "impulsion", "straightness", "collection"] as const;
const SCORE_LABELS: Record<string, string> = {
  rhythm: "Rhythm",
  relaxation: "Relaxation",
  connection: "Connection",
  impulsion: "Impulsion",
  straightness: "Straightness",
  collection: "Collection",
};

export default async function TrainInsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const d7 = subDays(now, 7);
  const d30 = subDays(now, 30);
  const d90 = subDays(now, 90);
  const d7Str = d7.toISOString().split("T")[0];
  const d30Str = d30.toISOString().split("T")[0];
  const d90Str = d90.toISOString().split("T")[0];

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("session_date", d90Str)
    .order("session_date", { ascending: false });

  const list = sessions || [];

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

  const last7 = list.filter((s) => s.session_date >= d7Str);
  const last30 = list.filter((s) => s.session_date >= d30Str);
  const last90 = list.filter((s) => s.session_date >= d90Str);

  const weeklyCount = last7.length;
  const monthlyCount = last30.length;

  const avgFeel = (arr: typeof list) =>
    arr.length > 0
      ? Math.round((arr.reduce((a, s) => a + s.overall_feel, 0) / arr.length) * 10) / 10
      : null;
  const avgFeel7 = avgFeel(last7);
  const avgFeel30 = avgFeel(last30);
  const avgFeel90 = avgFeel(last90);

  const categoryAverages = (arr: typeof list) => {
    const sums: Record<string, { sum: number; count: number }> = {};
    SCORE_KEYS.forEach((k) => { sums[k] = { sum: 0, count: 0 }; });
    arr.forEach((s) => {
      SCORE_KEYS.forEach((k) => {
        const v = s[k];
        if (v != null) {
          sums[k].sum += v;
          sums[k].count += 1;
        }
      });
    });
    return Object.fromEntries(
      SCORE_KEYS.map((k) => [
        k,
        sums[k].count > 0 ? Math.round((sums[k].sum / sums[k].count) * 10) / 10 : null,
      ])
    );
  };

  const avg7 = categoryAverages(last7);
  const avg30 = categoryAverages(last30);
  const avg90 = categoryAverages(last90);

  const exerciseCounts: Record<string, number> = {};
  list.forEach((s) => {
    if (!s.exercises) return;
    s.exercises
      .split(/[\n,]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .forEach((ex) => {
        exerciseCounts[ex] = (exerciseCounts[ex] || 0) + 1;
      });
  });
  const mostCommonExercises = Object.entries(exerciseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-muted-foreground">Consistency and growth from your logged sessions</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Consistency</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-cyan-400/20 bg-slate-800/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current streak</CardTitle>
              <Flame className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{currentStreak}</p>
              <p className="text-xs text-muted-foreground">consecutive days</p>
            </CardContent>
          </Card>
          <Card className="border-cyan-400/20 bg-slate-800/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessions (7d)</CardTitle>
              <Calendar className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{weeklyCount}</p>
            </CardContent>
          </Card>
          <Card className="border-cyan-400/20 bg-slate-800/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessions (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{monthlyCount}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Overall Feel trend</h2>
        <Card className="border-cyan-400/20">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Last 7 days</p>
                <p className="text-2xl font-bold text-cyan-400">{avgFeel7 != null ? `${avgFeel7}/10` : "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last 30 days</p>
                <p className="text-2xl font-bold text-cyan-400">{avgFeel30 != null ? `${avgFeel30}/10` : "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last 90 days</p>
                <p className="text-2xl font-bold text-cyan-400">{avgFeel90 != null ? `${avgFeel90}/10` : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Category averages (performance scores)</h2>
        <Card className="border-cyan-400/20">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyan-400/20">
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-right py-2 font-medium">7d</th>
                    <th className="text-right py-2 font-medium">30d</th>
                    <th className="text-right py-2 font-medium">90d</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORE_KEYS.map((key) => (
                    <tr key={key} className="border-b border-cyan-400/10">
                      <td className="py-2">{SCORE_LABELS[key]}</td>
                      <td className="text-right text-cyan-400/90">{avg7[key] != null ? avg7[key] : "—"}</td>
                      <td className="text-right text-cyan-400/90">{avg30[key] != null ? avg30[key] : "—"}</td>
                      <td className="text-right text-cyan-400/90">{avg90[key] != null ? avg90[key] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {mostCommonExercises.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Most common exercises</h2>
          <Card className="border-cyan-400/20">
            <CardContent className="pt-6">
              <ul className="flex flex-wrap gap-2">
                {mostCommonExercises.map(([name, count]) => (
                  <li
                    key={name}
                    className="rounded-md bg-cyan-400/10 border border-cyan-400/20 px-3 py-1.5 text-sm"
                  >
                    {name} <span className="text-muted-foreground">×{count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
