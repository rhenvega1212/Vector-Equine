import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Flame, Target } from "lucide-react";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";

export default async function VectorTodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const firstName = (profile?.display_name || "Rider").split(" ")[0];

  const { data: horses } = await supabase
    .from("horse_profiles")
    .select("id, name, barn_name, discipline, training_level, profile_photo_url")
    .eq("user_id", user.id)
    .order("name");

  const horseList = horses || [];
  const activeHorse = horseList[0] ?? null;

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select(
      "id, session_date, overall_feel, horse, horse_id, session_type, session_title, summary, rhythm, relaxation, connection, impulsion, straightness, collection"
    )
    .eq("user_id", user.id)
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

  const recent = list.slice(0, 2);
  const scored = list.filter((s) => s.connection != null || s.rhythm != null);
  const aidConsistency =
    scored.length > 0
      ? Math.round(
          (scored.reduce((acc, s) => {
            const vals = [s.rhythm, s.relaxation, s.connection, s.impulsion, s.straightness, s.collection].filter(
              (v): v is number => v != null
            );
            if (!vals.length) return acc;
            return acc + vals.reduce((a, b) => a + b, 0) / vals.length;
          }, 0) /
            scored.length) *
            20
        )
      : null;

  const focusLine =
    list[0]?.summary?.trim() ||
    (activeHorse
      ? `Work with ${activeHorse.name} on feel and timing — Vector will help you plan the ride.`
      : "Create your horse to start building a ride plan.");

  // Progressive disclosure: no horse yet
  if (horseList.length === 0) {
    return (
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Vector</p>
          <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Hi, {firstName}</h1>
          <p className="text-muted-foreground">Create your horse to open Today.</p>
        </header>
        <div className="rounded-xl border border-gold/20 bg-navy p-8 text-center">
          <p className="mb-4 text-cream/80">Everything in Vector hangs off your horse.</p>
          <Link href="/train/horses/new">
            <Button className="bg-gold text-navy font-semibold hover:bg-gold/90">Create your horse</Button>
          </Link>
          <p className="mt-3 text-xs text-cream/50">Start ride unlocks once a horse is on your roster.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Vector</p>
          <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Hi, {firstName}</h1>
          {activeHorse && (
            <Link
              href="/train/horse"
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-sm text-gold"
            >
              <span className="font-medium text-foreground">{activeHorse.name}</span>
              <span className="text-muted-foreground">·</span>
              <span>{activeHorse.training_level || activeHorse.discipline || "Horse"}</span>
              {horseList.length > 1 && (
                <span className="text-xs text-muted-foreground">· switch</span>
              )}
            </Link>
          )}
        </div>
      </header>

      <section className="rounded-xl border border-gold/25 bg-navy p-6 text-cream">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/80">Today&apos;s focus</p>
        <p className="mt-3 font-serif text-xl italic text-gold-bright">{focusLine}</p>
        <p className="mt-2 text-sm text-cream/60">
          Works alongside your trainer — bring these to your next lesson too.
        </p>
        <div className="mt-6">
          <Link href="/train/ride/plan">
            <Button size="lg" className="bg-gold text-navy font-semibold hover:bg-gold-bright">
              Start ride
            </Button>
          </Link>
        </div>
      </section>

      {list.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gold/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Aid consistency
              </p>
              <Target className="h-4 w-4 text-gold" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{aidConsistency != null ? `${aidConsistency}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">From recent training-scale scores</p>
          </div>
          <div className="rounded-xl border border-gold/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Streak</p>
              <Flame className="h-4 w-4 text-gold" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{currentStreak}</p>
            <p className="text-xs text-muted-foreground">days in a row</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gold/30 p-6 text-center">
          <p className="text-muted-foreground">No rides yet — start one to unlock progress tiles.</p>
          <Link href="/train/ride/plan" className="mt-3 inline-block text-sm text-gold hover:text-gold-bright">
            Plan your first ride →
          </Link>
        </div>
      )}

      {activeHorse && list.length > 0 && (
        <Link
          href="/train/horse"
          className="block rounded-xl border border-gold/15 bg-muted/30 px-4 py-3 text-sm text-muted-foreground hover:border-gold/30"
        >
          {activeHorse.name}&apos;s load this week — balanced. Tap for Health flags.
        </Link>
      )}

      {list.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Noticed
          </h2>
          <Link
            href="/train/ride/plan"
            className="block rounded-xl border border-gold/20 p-4 hover:border-gold/40"
          >
            <p className="font-medium">
              {aidConsistency != null && aidConsistency < 70
                ? "Connection scores are soft lately — ask Vector for a feel-focused plan."
                : "Your recent rides look steady — ask Vector to build on that."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Opens Plan</p>
          </Link>
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Recent ride
          </h2>
          <ul className="space-y-2">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/train/sessions/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-gold/10 p-3 hover:border-gold/30"
                >
                  <div>
                    <p className="font-medium">
                      {s.session_title?.trim() || format(parseISO(s.session_date), "MMM d")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                    </p>
                  </div>
                  <span className="font-semibold text-gold">{s.overall_feel}/10</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
