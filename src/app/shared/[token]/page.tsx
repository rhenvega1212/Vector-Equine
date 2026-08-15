import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { formatHomeCalendarDate } from "@/lib/timezone";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedDebriefPage({ params }: SharedPageProps) {
  const { token } = await params;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-[#0B1220] p-6">
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          This shared debrief is temporarily unavailable. Please try again later.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .eq("revoked", false)
    .maybeSingle();

  if (!link) notFound();
  if (link.expires_at && new Date(link.expires_at) < new Date()) notFound();

  const { data: session } = await supabase
    .from("training_sessions")
    .select(
      "id, session_date, session_title, session_type, overall_feel, summary, homework, horse, horse_id, user_id"
    )
    .eq("id", link.session_id)
    .maybeSingle();

  if (!session) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", session.user_id)
    .maybeSingle();

  let horseFirstName =
    (session.horse && String(session.horse).trim().split(/\s+/)[0]) || "Horse";

  if (session.horse_id) {
    const { data: horse } = await supabase
      .from("horse_profiles")
      .select("name, barn_name")
      .eq("id", session.horse_id)
      .maybeSingle();
    if (horse?.name) {
      horseFirstName = horse.barn_name?.trim() || horse.name.split(/\s+/)[0] || horse.name;
    }
  }

  const riderFirstName = (profile?.display_name || "Rider").split(/\s+/)[0] || "Rider";
  const summary =
    session.summary?.trim() ||
    "Session notes from this ride — feel and timing captured for coaching.";

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-background to-[#0B1220] text-foreground">
      <div className="mx-auto max-w-lg px-4 py-10 space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Shared debrief
          </p>
          <h1 className="font-serif text-3xl">
            {session.session_title?.trim() ||
              formatHomeCalendarDate(session.session_date, "EEEE, MMMM d")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {riderFirstName} · {horseFirstName} ·{" "}
            {formatHomeCalendarDate(session.session_date, "MMM d, yyyy")}
          </p>
        </header>

        <section className="rounded-xl border border-gold/25 bg-navy p-6 text-cream">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cream/50">Execution score</p>
          <p className="mt-2 font-serif text-5xl text-gold">{session.overall_feel}</p>
          <p className="mt-3 font-serif text-lg italic text-gold-bright">{summary}</p>
        </section>

        {session.homework?.trim() && (
          <section className="rounded-xl border border-gold/20 p-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
              Homework
            </p>
            <p className="text-sm leading-relaxed">{session.homework}</p>
          </section>
        )}

        <section className="rounded-xl border border-gold/20 bg-gold/10 px-5 py-5 text-center space-y-3">
          <p className="text-sm text-foreground/90">
            Coaching {riderFirstName} regularly? Create a free trainer account.
          </p>
          <Button
            asChild
            className="bg-gold text-navy font-semibold hover:bg-gold-bright"
          >
            <Link href="/signup">Create trainer account</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
