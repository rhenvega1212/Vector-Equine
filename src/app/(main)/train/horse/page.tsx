import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { format, parseISO } from "date-fns";

interface HorseRoomProps {
  searchParams: Promise<{ horse?: string }>;
}

export default async function HorseRoomPage({ searchParams }: HorseRoomProps) {
  const { horse: horseParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: horses } = await supabase
    .from("horse_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  const list = horses || [];
  if (list.length === 0) {
    return (
      <div className="space-y-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Horse</p>
        <h1 className="font-serif text-3xl">Add your first horse</h1>
        <p className="text-muted-foreground">Health and history unlock once a horse is on your roster.</p>
        <Link href="/train/horses/new">
          <Button className="bg-gold text-navy font-semibold hover:bg-gold/90">Create horse</Button>
        </Link>
      </div>
    );
  }

  const active = list.find((h) => h.id === horseParam) || list[0];

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, session_date, session_title, session_type, overall_feel, summary")
    .eq("user_id", user.id)
    .eq("horse_id", active.id)
    .order("session_date", { ascending: false })
    .limit(20);

  const history = sessions || [];
  const hasEnoughForHealth = history.length >= 3;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Horse</p>
        <div className="flex flex-wrap items-center gap-2">
          {list.map((h) => (
            <Link
              key={h.id}
              href={`/train/horse?horse=${h.id}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                h.id === active.id
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border text-muted-foreground hover:border-gold/40"
              }`}
            >
              {h.name}
            </Link>
          ))}
          <Link href="/train/horses/new" className="text-sm text-gold hover:text-gold-bright">
            + Add
          </Link>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl">{active.name}</h1>
        {active.barn_name && (
          <p className="text-muted-foreground">&ldquo;{active.barn_name}&rdquo;</p>
        )}
      </header>

      <Section title="Profile">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <Fact label="Breed" value={active.breed} />
          <Fact label="Age" value={active.age != null ? String(active.age) : null} />
          <Fact label="Discipline" value={active.discipline} />
          <Fact label="Level" value={active.training_level} />
          <Fact label="Goals" value={active.goals} />
        </dl>
        <Link
          href={`/train/horses/${active.id}/edit`}
          className="mt-4 inline-block text-sm text-gold hover:text-gold-bright"
        >
          Edit profile →
        </Link>
      </Section>

      <Diamond />

      <Section title="Health">
        {hasEnoughForHealth ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Load this week — balanced</li>
            <li>Recovery — looking settled</li>
            <li>Symmetry — no watch note</li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Health flags unlock as you ride. A few more sessions and we&apos;ll surface calm watch notes here — never a diagnosis.
          </p>
        )}
      </Section>

      <Diamond />

      <Section title="Predict">
        {hasEnoughForHealth ? (
          <p className="text-sm text-muted-foreground">
            Readiness looks steady. Pattern: keep mid-week volume moderate.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            These unlock as you ride — readiness and patterns need a short history first.
          </p>
        )}
      </Section>

      <Diamond />

      <Section title="History">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rides for {active.name} yet.{" "}
            <Link href="/train/ride/plan" className="text-gold hover:text-gold-bright">
              Start a ride
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/train/sessions/${s.id}`}
                  className="flex justify-between rounded-lg border border-gold/10 p-3 hover:border-gold/30"
                >
                  <div>
                    <p className="font-medium">
                      {s.session_title?.trim() || format(parseISO(s.session_date), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                    </p>
                  </div>
                  <span className="text-gold font-medium">{s.overall_feel}/10</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/train/sessions" className="mt-3 inline-block text-sm text-gold hover:text-gold-bright">
          All sessions →
        </Link>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value?.trim() || "—"}</dd>
    </div>
  );
}

function Diamond() {
  return <div className="text-center text-gold/40 select-none" aria-hidden>◇</div>;
}
