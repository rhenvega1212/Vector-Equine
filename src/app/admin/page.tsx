import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Flag } from "lucide-react";

export default async function AdminPage() {
  const supabase = await createClient();

  const [
    { count: usersCount },
    { count: pendingReportsCount },
    { count: trainersAwaitingApproval },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground">Platform health at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={
                "highlight" in stat && stat.highlight
                  ? "border-destructive/50"
                  : undefined
              }
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(trainersAwaitingApproval || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trainers awaiting approval</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {trainersAwaitingApproval} trainer account
              {(trainersAwaitingApproval || 0) === 1 ? "" : "s"} pending review in Users.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
