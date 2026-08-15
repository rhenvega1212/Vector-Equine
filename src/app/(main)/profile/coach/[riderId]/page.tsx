import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatHomeCalendarDate } from "@/lib/timezone";
import { ArrowLeft } from "lucide-react";

interface CoachRiderPageProps {
  params: Promise<{ riderId: string }>;
}

export default async function CoachRiderPage({ params }: CoachRiderPageProps) {
  const { riderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: connection } = await supabase
    .from("coach_connections")
    .select("id, status, share_scope")
    .eq("trainer_id", user.id)
    .eq("rider_id", riderId)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) notFound();

  const { data: me } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { data: rider } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .eq("id", riderId)
    .maybeSingle();

  if (!rider) notFound();

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select(
      "id, session_date, session_title, overall_feel, horse, horse_id, summary, homework"
    )
    .eq("user_id", riderId)
    .order("session_date", { ascending: false })
    .limit(40);

  const horseIds = Array.from(
    new Set(
      (sessions || [])
        .map((s) => s.horse_id)
        .filter((id): id is string => typeof id === "string")
    )
  );

  const horseNameById = new Map<string, string>();
  if (horseIds.length > 0) {
    const { data: horses } = await supabase
      .from("horse_profiles")
      .select("id, name, barn_name")
      .in("id", horseIds);
    for (const h of horses || []) {
      horseNameById.set(h.id, h.barn_name?.trim() || h.name);
    }
  }

  const displayName = rider.display_name || rider.username || "Rider";
  const monogram = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const backHref = me?.username ? `/profile/${me.username}` : "/profile";

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="text-cream/70 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Profile
          </Button>
        </Link>
      </div>

      <header className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-[#131C31] font-serif text-lg text-gold">
          {monogram}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Rider roster
          </p>
          <h1 className="font-serif text-2xl text-cream">{displayName}</h1>
          <p className="text-xs text-cream/50">
            @{rider.username || "—"} · sharing:{" "}
            {connection.share_scope === "all" ? "all rides" : "shared only"}
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Shared sessions
        </h2>
        {!sessions?.length ? (
          <p className="text-sm text-cream/50">
            No shared sessions yet. When this rider shares a ride (or sets sharing to all
            rides), it will show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const horse =
                (s.horse_id && horseNameById.get(s.horse_id)) ||
                s.horse?.trim() ||
                "Horse";
              return (
                <li key={s.id}>
                  <Link
                    href={`/train/sessions/${s.id}`}
                    className="block rounded-xl border border-gold/15 bg-[#131C31] px-4 py-3 transition-colors hover:border-gold/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-cream">
                          {s.session_title?.trim() ||
                            formatHomeCalendarDate(s.session_date, "EEEE, MMM d")}
                        </p>
                        <p className="text-xs text-cream/50">
                          {horse} · {formatHomeCalendarDate(s.session_date, "MMM d, yyyy")}
                        </p>
                      </div>
                      <p className="font-serif text-xl text-gold">{s.overall_feel}</p>
                    </div>
                    {(s.summary || s.homework) && (
                      <p className="mt-2 line-clamp-2 text-xs text-cream/60">
                        {s.homework?.trim() || s.summary?.trim()}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
