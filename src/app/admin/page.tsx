import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Flag, Trophy } from "lucide-react";

export default async function AdminPage() {
  const supabase = await createClient();

  // Get counts (events removed)
  const [
    { count: usersCount },
    { count: pendingReportsCount },
    { count: challengesCount },
    { count: trainersAwaitingApproval },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("challenges").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "trainer")
      .eq("trainer_approved", false),
  ]);

  const stats = [
    {
      title: "Total Users",
      value: usersCount || 0,
      icon: Users,
      description: "Registered accounts",
    },
    {
      title: "Pending Reports",
      value: pendingReportsCount || 0,
      icon: Flag,
      description: "Needs review",
      highlight: (pendingReportsCount || 0) > 0,
    },
    {
      title: "Challenges",
      value: challengesCount || 0,
      icon: Trophy,
      description: "Published and draft",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Overview</h2>
        <p className="text-muted-foreground">
          Welcome to the admin dashboard
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    stat.highlight ? "text-destructive" : ""
                  }`}
                >
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(trainersAwaitingApproval || 0) > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="text-lg">Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {trainersAwaitingApproval} trainer(s) awaiting approval.{" "}
              <a href="/admin/users" className="text-primary hover:underline">
                Review now
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
