import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { HorseCard } from "@/components/train/horse-card";
import { Plus } from "lucide-react";

export default async function TrainHorsesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: horses } = await supabase
    .from("horse_profiles")
    .select("id, name, barn_name, discipline, profile_photo_url, training_level")
    .eq("user_id", user.id)
    .order("name");

  const { data: sessionCounts } = await supabase
    .from("training_sessions")
    .select("horse_id")
    .eq("user_id", user.id);

  const countByHorse = (sessionCounts || []).reduce<Record<string, number>>((acc, row) => {
    const id = row.horse_id as string | null;
    if (id) {
      acc[id] = (acc[id] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Horses</h1>
          <p className="text-muted-foreground">Manage your horse profiles and view ride history by horse.</p>
        </div>
        <Link href="/train/horses/new">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add horse
          </Button>
        </Link>
      </div>

      {(!horses || horses.length === 0) ? (
        <div className="rounded-lg border border-cyan-400/20 bg-slate-800/30 p-8 text-center">
          <p className="text-muted-foreground mb-2">No horses yet.</p>
          <p className="text-sm text-muted-foreground mb-4">Add a horse to log sessions and track progress.</p>
          <Link href="/train/horses/new">
            <Button className="bg-cyan-500 hover:bg-cyan-400 text-black">Add your first horse</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {horses.map((horse) => (
            <HorseCard
              key={horse.id}
              horse={horse}
              showSessionCount={countByHorse[horse.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
