import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { HEALTH_FLAG_LABELS, type HealthFlagKey } from "@/lib/validations/vector-setup";
import { format, parseISO } from "date-fns";
import { HorseSwitcher } from "@/components/train/horse-switcher";
import {
  formatSessionWhen,
  sessionDisplayTitle,
} from "@/lib/train/format-session-when";

const UNLOCK_SESSIONS = 3;

interface HorseRoomProps {
  searchParams: Promise<{ horseId?: string }>;
}

export default async function HorseRoomPage({ searchParams }: HorseRoomProps) {
  const { horseId: horseIdParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: horses, error: horsesError } = await supabase
    .from("horse_profiles")
    .select(
      "id, name, barn_name, breed, age, sex, height, color, discipline, training_level, goals, personality_quirks, injuries_limitations, notes, profile_photo_url, months_together, sessions_per_week, current_focus, sticking_points, health_flags, health_flag_notes"
    )
    .eq("user_id", user.id)
    .order("name");

  const horseList = horsesError ? [] : horses || [];

  if (horseList.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Horse
          </p>
          <h1 className="mt-1 font-serif text-3xl text-cream">Your horse room</h1>
        </header>
        <div className="rounded-xl border border-gold/20 bg-[#131C31] p-6 space-y-4">
          <p className="font-serif text-xl text-cream">Create your horse to begin.</p>
          <p className="text-sm text-cream/50">
            Profile, health flags, and history unlock once you have a horse on Vector.
          </p>
          <Button className="bg-gold text-navy font-semibold hover:bg-gold-bright" asChild>
            <Link href="/train/setup">Set up Vector</Link>
          </Button>
        </div>
      </div>
    );
  }

  const active =
    horseList.find((h) => h.id === horseIdParam) || horseList[0]!;

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select(
      "id, session_date, created_at, session_title, session_type, overall_feel, summary, homework, notes, duration_minutes, rhythm, relaxation, connection, impulsion, straightness, collection"
    )
    .eq("user_id", user.id)
    .eq("horse_id", active.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const list = sessions || [];
  const sessionCount = list.length;
  const unlocked = sessionCount >= UNLOCK_SESSIONS;

  const recentWeek = list.filter((s) => {
    const d = parseISO(s.session_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  });
  const weekMinutes = recentWeek.reduce(
    (acc, s) => acc + (s.duration_minutes || 40),
    0
  );
  const loadLabel =
    weekMinutes === 0
      ? "quiet"
      : weekMinutes < 90
        ? "light"
        : weekMinutes < 180
          ? "balanced"
          : "full";

  const scored = list.filter((s) => s.connection != null || s.rhythm != null).slice(0, 5);
  const avgScale =
    scored.length > 0
      ? scored.reduce((acc, s) => {
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
        }, 0) / scored.length
      : null;

  const readiness =
    avgScale == null
      ? null
      : avgScale >= 3.5
        ? "Ready to ask a little more"
        : avgScale >= 2.8
          ? "Steady — keep the program"
          : "A lighter week may help";

  const displayName = active.barn_name?.trim() || active.name;
  const profileRows: { label: string; value: string }[] = [
    { label: "Breed", value: active.breed || "—" },
    { label: "Age", value: active.age != null ? String(active.age) : "—" },
    { label: "Sex", value: active.sex || "—" },
    { label: "Height", value: active.height || "—" },
    { label: "Color", value: active.color || "—" },
    {
      label: "Level",
      value: active.training_level || active.discipline || "—",
    },
  ];

  const healthFlags = Array.isArray(active.health_flags)
    ? (active.health_flags as string[]).filter(
        (k): k is HealthFlagKey => k in HEALTH_FLAG_LABELS
      )
    : [];
  const hasPair =
    active.months_together != null ||
    active.sessions_per_week != null ||
    !!active.current_focus?.trim() ||
    !!active.sticking_points?.trim();

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Horse
          </p>
          <h1 className="mt-1 font-serif text-3xl text-cream">{displayName}</h1>
          <p className="mt-1 text-sm text-cream/50">
            {active.training_level || active.discipline || "Horse"} · {sessionCount}{" "}
            {sessionCount === 1 ? "ride" : "rides"}
          </p>
        </div>
        <HorseSwitcher
          horses={horseList.map((h) => ({
            id: h.id,
            name: h.barn_name?.trim() || h.name,
            level: h.training_level || h.discipline,
          }))}
          activeId={active.id}
        />
      </header>

      {/* Profile */}
      <section className="space-y-4">
        <SectionLabel>Profile</SectionLabel>
        <div className="rounded-xl border border-gold/15 bg-[#131C31] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profileRows.map((r) => (
              <div key={r.label}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                  {r.label}
                </p>
                <p className="mt-0.5 text-sm text-cream">{r.value}</p>
              </div>
            ))}
          </div>
          {active.goals?.trim() && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">Goals</p>
              <p className="mt-1 text-sm text-cream/85">{active.goals}</p>
            </div>
          )}
          {active.injuries_limitations?.trim() && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                Notes for care
              </p>
              <p className="mt-1 text-sm text-cream/85">{active.injuries_limitations}</p>
            </div>
          )}
          {hasPair && (
            <div className="space-y-3 border-t border-gold/10 pt-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gold/80">
                Starting place · pair
              </p>
              <div className="grid grid-cols-2 gap-3">
                {active.months_together != null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                      Months together
                    </p>
                    <p className="mt-0.5 text-sm text-cream">{active.months_together}</p>
                  </div>
                )}
                {active.sessions_per_week != null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                      Sessions / week
                    </p>
                    <p className="mt-0.5 text-sm text-cream">{active.sessions_per_week}</p>
                  </div>
                )}
              </div>
              {active.current_focus?.trim() && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                    Current focus
                  </p>
                  <p className="mt-1 text-sm text-cream/85">{active.current_focus}</p>
                </div>
              )}
              {active.sticking_points?.trim() && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                    Sticking points
                  </p>
                  <p className="mt-1 text-sm text-cream/85">{active.sticking_points}</p>
                </div>
              )}
            </div>
          )}
          {(healthFlags.length > 0 || active.health_flag_notes?.trim()) && (
            <div className="space-y-3 border-t border-gold/10 pt-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gold/80">
                Starting place · health flags
              </p>
              <p className="text-xs text-cream/45">
                Flags for Vector — not a diagnosis.
              </p>
              {healthFlags.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {healthFlags.map((key) => (
                    <li
                      key={key}
                      className="rounded-md border border-gold/20 bg-navy/40 px-2.5 py-1 text-xs text-cream/80"
                    >
                      {HEALTH_FLAG_LABELS[key]}
                    </li>
                  ))}
                </ul>
              )}
              {active.health_flag_notes?.trim() && (
                <p className="text-sm text-cream/85">{active.health_flag_notes}</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" className="border-gold/30" asChild>
              <Link href={`/train/horses/${active.id}/edit`}>Edit profile</Link>
            </Button>
            <Button size="sm" variant="ghost" className="text-cream/60" asChild>
              <Link href="/train/horses">Manage horses</Link>
            </Button>
          </div>
        </div>
      </section>

      <DiamondDivider />

      {/* Health */}
      <section className="space-y-4">
        <SectionLabel>Health</SectionLabel>
        {!unlocked ? (
          <UnlockNote />
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                Training load · this week
              </p>
              <div className="mt-3 mb-2 flex h-2 overflow-hidden rounded-full bg-[#1A2440]">
                <div
                  className="bg-gold/70"
                  style={{
                    width: `${Math.min(100, (weekMinutes / 240) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-sm text-cream">
                {displayName}&apos;s load —{" "}
                <span className="text-gold">{loadLabel}</span>
                {weekMinutes > 0 ? ` · ~${weekMinutes} min` : ""}.
              </p>
              <p className="mt-1 text-xs text-cream/50">
                Flags for awareness — not a diagnosis. Share with your vet or trainer if
                something feels off.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FlagTile
                label="Recovery"
                value={
                  recentWeek.length <= 2
                    ? "Trending rested"
                    : "Watch rest days"
                }
              />
              <FlagTile
                label="Symmetry"
                value="Even on recent rides ✓"
              />
            </div>
          </div>
        )}
      </section>

      <DiamondDivider />

      {/* Predict */}
      <section className="space-y-4">
        <SectionLabel>Predict</SectionLabel>
        {!unlocked ? (
          <UnlockNote />
        ) : (
          <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
              Readiness
            </p>
            <p className="font-serif text-xl text-cream">
              {readiness || "Keep building the pattern"}
            </p>
            <p className="text-xs text-cream/50">
              Based on recent feel and training-scale marks — a forecast for planning, not a
              medical call.
            </p>
          </div>
        )}
      </section>

      <DiamondDivider />

      {/* History */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>History</SectionLabel>
          {sessionCount > 0 && (
            <Link
              href={`/train/sessions?horse_id=${active.id}`}
              className="text-xs text-gold hover:text-gold-bright"
            >
              See all
            </Link>
          )}
        </div>
        {sessionCount === 0 ? (
          <div className="rounded-xl border border-gold/15 bg-[#131C31] p-5 space-y-3">
            <p className="font-serif text-lg text-cream">No rides yet for {displayName}.</p>
            <p className="text-sm text-cream/50">
              Start a ride — the timeline fills in as you go.
            </p>
            <Button className="bg-gold text-navy font-semibold hover:bg-gold-bright" asChild>
              <Link href={`/train/ride/plan?horseId=${active.id}`}>Start ride</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.slice(0, 8).map((s) => (
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
                    {(s.homework || s.summary) && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-cream/50">
                        {s.homework?.trim() || s.summary?.trim()}
                      </p>
                    )}
                  </div>
                  <span className="font-serif text-lg text-gold">{s.overall_feel}/10</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
      {children}
    </h2>
  );
}

function DiamondDivider() {
  return (
    <div className="flex items-center gap-3 text-gold/40" aria-hidden>
      <div className="h-px flex-1 bg-gold/15" />
      <span className="text-xs">◇</span>
      <div className="h-px flex-1 bg-gold/15" />
    </div>
  );
}

function UnlockNote() {
  return (
    <div className="rounded-xl border border-gold/10 bg-[#131C31]/80 px-4 py-4">
      <p className="text-sm text-cream/70">
        These unlock as you ride — after a few sessions, Vector can show calm load and
        readiness flags for this horse.
      </p>
    </div>
  );
}

function FlagTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">{label}</p>
      <p className="mt-1 text-sm text-cream">{value}</p>
    </div>
  );
}
