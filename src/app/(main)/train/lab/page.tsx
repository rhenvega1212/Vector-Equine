import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VECTOR_CONFIG } from "@/lib/vector/config";
import { Button } from "@/components/ui/button";
import { formatInHomeTz } from "@/lib/timezone";
import { LabExportButton } from "@/components/capture/lab-export-button";
import { LabEdgePair } from "@/components/capture/lab-edge-pair";
import { LabStartTestLesson } from "@/components/capture/lab-start-test-lesson";
import { getCurrentProfile } from "@/lib/auth/current-profile";

interface LabPageProps {
  searchParams: Promise<{ capture?: string }>;
}

export default async function CaptureLabPage({ searchParams }: LabPageProps) {
  if (!VECTOR_CONFIG.CAPTURE_LAB) {
    redirect("/train");
  }

  const { capture: highlightId } = await searchParams;
  const { user, profile } = await getCurrentProfile();
  if (!user) return null;

  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";

  const { data: horses } = await supabase
    .from("horse_profiles")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const defaultHorseId = horses?.[0]?.id ?? null;

  const { data: captures } = await supabase
    .from("capture_sessions")
    .select(
      "id, join_code, status, t0, ended_at, horse_id, training_session_id, trainer_display_name, is_test"
    )
    .eq("rider_id", user.id)
    .order("started_at", { ascending: false })
    .limit(40);

  const list = captures || [];

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
          Lab
        </p>
        <h1 className="font-serif text-3xl text-cream">Capture dataset</h1>
        <p className="text-sm text-cream/55">
          Builder view — export timelines for video/sensor sync. Customer journal stays on
          Debrief.
        </p>
      </header>

      {isAdmin ? <LabStartTestLesson horseId={defaultHorseId} /> : null}

      <LabEdgePair />

      <section className="rounded-xl border border-gold/15 bg-[#131C31] p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
          Sync model
        </p>
        <p className="text-sm text-cream/70">
          Master clock is session <code className="text-gold/80">t0</code>. Jetson
          uploads video with <code className="text-gold/80">sync_offset_ms</code>;
          transcript uses the same offsets. Sensors (raw) stay off the client —
          insights only, next phase.
        </p>
      </section>

      {list.length === 0 ? (
        <p className="text-sm text-cream/50">
          No captures yet. Start a lesson from{" "}
          <Link href="/train/ride/live" className="text-gold underline">
            Live
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl border p-4 space-y-3 ${
                highlightId === c.id
                  ? "border-gold bg-gold/5"
                  : "border-gold/15 bg-[#131C31]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-lg text-cream">
                    {c.is_test ? (
                      <span className="mr-2 text-[10px] uppercase tracking-[0.2em] text-gold">
                        Test
                      </span>
                    ) : null}
                    {c.status === "ended" ? "Ended" : c.status} · {c.join_code}
                  </p>
                  <p className="text-xs text-cream/45">
                    Started {formatInHomeTz(c.t0, "MMM d, yyyy · h:mm a")}
                    {c.ended_at
                      ? ` · ended ${formatInHomeTz(c.ended_at, "h:mm a")}`
                      : ""}
                    {c.trainer_display_name
                      ? ` · trainer ${c.trainer_display_name}`
                      : ""}
                  </p>
                  {!c.ended_at && c.join_code ? (
                    <p className="mt-1 text-xs text-cream/50">
                      Join on second phone:{" "}
                      <Link
                        href={`/join/${c.join_code}`}
                        className="text-gold underline"
                      >
                        /join/{c.join_code}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <LabExportButton captureId={c.id} />
                  {c.training_session_id && (
                    <Button size="sm" variant="outline" className="border-gold/30" asChild>
                      <Link href={`/train/sessions/${c.training_session_id}`}>
                        Debrief
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-cream/40">
                Edge video lands in session_media_assets after Jetson upload. Export
                includes media[] when present.
              </p>
            </li>
          ))}
        </ul>
      )}

      <Button variant="ghost" className="text-cream/60" asChild>
        <Link href="/train">Back to Ride</Link>
      </Button>
    </div>
  );
}
