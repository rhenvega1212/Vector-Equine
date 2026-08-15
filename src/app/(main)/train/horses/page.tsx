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
    .eq("user_id", user.id)
    .eq("is_test", false);

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Roster</p>
          <h1 className="mt-1 font-serif text-3xl">Horses</h1>
          <p className="text-cream/60">Manage your horse profiles and view ride history by horse.</p>
        </div>
        <Link href="/train/horses/new">
          <Button className="bg-gold text-navy font-semibold hover:bg-gold/90 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add horse
          </Button>
        </Link>
      </div>

      {(!horses || horses.length === 0) ? (
        <div className="rounded-lg border border-gold/20 bg-white/5 p-8 text-center">
          <p className="text-cream/70 mb-2">No horses yet.</p>
          <p className="text-sm text-cream/50 mb-4">Add a horse to log sessions and track progress.</p>
          <Link href="/train/horses/new">
            <Button className="bg-gold text-navy font-semibold hover:bg-gold/90">Add your first horse</Button>
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
