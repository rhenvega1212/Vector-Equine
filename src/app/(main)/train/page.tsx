import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { HorseSwitcher } from "@/components/train/horse-switcher";
import {
  formatSessionWhen,
  sessionDisplayTitle,
} from "@/lib/train/format-session-when";

interface TodayProps {
  searchParams: Promise<{ horseId?: string }>;
}

export default async function VectorTodayPage({ searchParams }: TodayProps) {
  const { horseId: horseIdParam } = await searchParams;
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

  const firstName =
    profile?.display_name?.trim().split(/\s+/)[0] || "there";

  const { data: horses, error: horsesError } = await supabase
    .from("horse_profiles")
    .select("id, name, barn_name, discipline, training_level, breed, age")
    .eq("user_id", user.id)
    .order("name");

  const horseList = horsesError ? [] : horses || [];
  const activeHorse =
    horseList.find((h) => h.id === horseIdParam) || horseList[0] || null;

  // No horse yet — progressive disclosure
  if (!activeHorse) {
    return (
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Vector
          </p>
          <h1 className="font-serif text-3xl text-cream sm:text-4xl">
            Welcome, {firstName}.
          </h1>
        </header>
        <section className="rounded-xl border border-gold/20 bg-[#131C31] p-6 space-y-4">
          <h2 className="font-serif text-2xl text-cream">Set up your horse</h2>
          <p className="text-sm text-cream/50">
            Vector starts with a baseline for you and your horse. Finish setup to open the Loop.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-gold text-navy font-semibold hover:bg-gold-bright" asChild>
              <Link href="/train/setup">Continue setup</Link>
            </Button>
            <Button
              variant="outline"
              className="border-gold/30 text-cream/40"
              disabled
            >
              Start ride
            </Button>
          </div>
        </section>
        <p className="text-center text-xs text-cream/40">
          You ride. Vector assists — alongside your trainer.
        </p>
      </div>
    );
  }

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select(
      "id, session_date, created_at, overall_feel, horse, horse_id, session_type, session_title, summary, notes, rhythm, relaxation, connection, impulsion, straightness, collection"
    )
    .eq("user_id", user.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

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
  const recentIds = recent.map((s) => s.id);
  const trainerBySession = new Map<string, string>();
  if (recentIds.length > 0) {
    const { data: captures } = await supabase
      .from("capture_sessions")
      .select("training_session_id, trainer_display_name")
      .in("training_session_id", recentIds);
    for (const c of captures || []) {
      if (c.training_session_id && c.trainer_display_name) {
        trainerBySession.set(c.training_session_id, c.trainer_display_name);
      }
    }
  }
  const scored = list.filter((s) => s.connection != null || s.rhythm != null);
  const aidConsistency =
    scored.length > 0
      ? Math.round(
          (scored.reduce((acc, s) => {
            const vals = [
              s.rhythm,
              s.relaxation,
              s.connection,
              s.impulsion,
              s.straightness,
              s.collection,
            ].filter((v): v is number => v != null);
            if (!vals.length) return acc;
            return acc + vals.reduce((a, b) => a + b, 0) / vals.length;
          }, 0) /
            scored.length) *
            20
        )
      : null;

  const displayName = activeHorse.barn_name?.trim() || activeHorse.name;
  const level = activeHorse.training_level || activeHorse.discipline || "Horse";
  const planHref = `/train/ride/plan?horseId=${activeHorse.id}`;
  const liveHref = `/train/ride/live?horseId=${activeHorse.id}`;
  const horseHref = `/train/horse?horseId=${activeHorse.id}`;
  const hasSessions = list.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Vector
          </p>
          <h1 className="font-serif text-3xl text-cream sm:text-4xl">
            Welcome back, {firstName}.
          </h1>
        </div>
        <HorseSwitcher
          horses={horseList.map((h) => ({
            id: h.id,
            name: h.barn_name?.trim() || h.name,
            level: h.training_level || h.discipline,
          }))}
          activeId={activeHorse.id}
        />
      </header>

      <section className="rounded-xl border border-gold/20 bg-[#131C31] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cream/50">
          Today&apos;s focus
        </p>
        <h2 className="mt-3 font-serif text-2xl text-cream">
          {hasSessions ? "Build on yesterday." : "Your first ride with Vector."}
        </h2>
        <p className="mt-2 font-serif text-lg italic text-gold">
          {hasSessions
            ? "One clear goal. Vector works alongside your trainer."
            : "Plan a goal, ride it, and get a calm debrief."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="bg-gold text-navy font-semibold hover:bg-gold-bright" asChild>
            <Link href={planHref}>Plan today&apos;s ride</Link>
          </Button>
          <Button variant="outline" className="border-gold/40 text-gold hover:bg-gold/10" asChild>
            <Link href={liveHref}>Start ride</Link>
          </Button>
        </div>
      </section>

      {hasSessions ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cream/50">
                Aid consistency · 30 days
              </p>
              <p className="mt-2 font-serif text-4xl text-gold">
                {aidConsistency != null ? `${aidConsistency}%` : "—"}
              </p>
              {aidConsistency != null && (
                <p className="mt-1 text-xs text-[#7FB08A]">From your training-scale marks</p>
              )}
            </div>
            <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cream/50">
                Day streak
              </p>
              <p className="mt-2 font-serif text-4xl text-gold">{currentStreak}</p>
            </div>
          </div>

          <Link
            href={horseHref}
            className="block rounded-xl border border-gold/15 bg-[#131C31] px-4 py-4 hover:border-gold/30"
          >
            <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-[#1A2440]">
              <div className="w-[40%] bg-gold/70" />
              <div className="w-[60%] bg-cream/10" />
            </div>
            <p className="text-sm text-cream">
              {displayName}&apos;s load this week —{" "}
              <span className="text-gold">see Health</span>
            </p>
            <p className="mt-1 text-xs text-cream/50">
              Calm flags only — never a diagnosis.
            </p>
          </Link>

          <section className="space-y-2">
            <div className="rounded-xl border border-gold/15 border-l-2 border-l-gold bg-[#131C31] p-4">
              <p className="text-sm text-cream">
                {list[0]?.summary?.split(".")[0]?.trim() ||
                  `A pattern from ${displayName}'s recent rides is ready to work on.`}
                .
              </p>
              <Link
                href={planHref}
                className="mt-2 inline-block text-sm text-gold hover:text-gold-bright"
              >
                Work on it →
              </Link>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cream/50">
              Recent rides
            </h2>
            <ul className="space-y-2">
              {recent.map((s) => {
                const withTrainer =
                  trainerBySession.get(s.id) ||
                  (typeof s.notes === "string" && /^With\s+/i.test(s.notes)
                    ? s.notes.replace(/^With\s+/i, "").trim()
                    : null);
                return (
                <li key={s.id}>
                  <Link
                    href={`/train/sessions/${s.id}`}
                    className="flex items-center justify-between rounded-lg border border-gold/10 bg-[#131C31] p-3 hover:border-gold/30"
                  >
                    <div>
                      <p className="text-xs text-cream/45">
                        {formatSessionWhen(s.session_date, s.created_at, {
                          includeYear: false,
                        })}
                      </p>
                      <p className="font-medium text-cream">
                        {sessionDisplayTitle(
                          s.session_title,
                          s.notes?.split(" — ")[0]?.trim() ||
                            SESSION_TYPE_LABELS[s.session_type] ||
                            s.session_type
                        )}
                      </p>
                      <p className="text-xs text-gold/80">
                        {withTrainer
                          ? `Lesson with ${withTrainer} · Debrief`
                          : "Debrief"}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-cream/40">
                      Open
                    </span>
                  </Link>
                </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-gold/15 bg-[#131C31] p-5 space-y-2">
          <p className="font-serif text-lg text-cream">No rides yet</p>
          <p className="text-sm text-cream/50">
            Progress tiles and {displayName}&apos;s timeline appear after your first session.
            Level: {level}.
          </p>
          <Button className="mt-2 bg-gold text-navy font-semibold hover:bg-gold-bright" asChild>
            <Link href={planHref}>Start your first ride</Link>
          </Button>
        </section>
      )}

      <p className="text-center text-xs text-cream/40">
        You ride. Vector assists — alongside your trainer.
      </p>
    </div>
  );
}
