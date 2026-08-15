import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { formatHomeCalendarDate } from "@/lib/timezone";
import { Pencil, Plus, Calendar } from "lucide-react";
import { HorseHeadIcon } from "@/components/icons/horse-head";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";
import { SetActiveHorse } from "@/components/train/set-active-horse";

interface HorseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HorseDetailPage({ params }: HorseDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: horse, error } = await supabase
    .from("horse_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !horse) notFound();

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, session_date, session_title, session_type, duration_minutes, overall_feel, video_link_url, video_upload_path")
    .eq("horse_id", id)
    .eq("is_test", false)
    .order("session_date", { ascending: false })
    .limit(50);

  const displayName = horse.barn_name?.trim()
    ? `${horse.name} (“${horse.barn_name}”)`
    : horse.name;
  const shortName = horse.barn_name?.trim() || horse.name;
  const photoUrl = horse.profile_photo_url?.trim() || null;

  const detailRows = [
    { label: "Breed", value: horse.breed },
    { label: "Age", value: horse.age != null ? String(horse.age) : null },
    { label: "Birthday", value: horse.birthday },
    { label: "Sex", value: horse.sex },
    { label: "Height", value: horse.height },
    { label: "Color", value: horse.color },
    { label: "Discipline", value: horse.discipline },
    { label: "Training level", value: horse.training_level },
    { label: "Owner", value: horse.owner },
    { label: "Rider", value: horse.rider },
    { label: "Trainer", value: horse.trainer },
    { label: "Purchase / lease", value: horse.purchase_lease_status },
    { label: "Date acquired", value: horse.date_acquired },
  ].filter((r) => r.value);

  return (
    <div className="space-y-6">
      <SetActiveHorse horseId={horse.id} />

      <AtmosphereScreen
        className="overflow-hidden rounded-none sm:-mx-4"
        heroImageUrl={photoUrl}
      >
        <div className="px-7 pb-10 pt-6 sm:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/train/horses"
              className="text-[12.5px] tracking-[0.04em] text-gold hover:text-gold-bright"
            >
              ← Horses
            </Link>
            <div className="flex gap-2">
              <Link href={`/train/sessions/new?horse_id=${horse.id}`}>
                <Button
                  size="sm"
                  className="bg-gold font-semibold text-navy hover:bg-gold-bright"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Log session
                </Button>
              </Link>
              <Link href={`/train/horses/${horse.id}/edit`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gold/35 bg-transparent text-cream hover:bg-white/5"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>

          {!photoUrl ? (
            <div className="mt-8 flex h-24 w-24 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <HorseHeadIcon size={48} className="text-gold" />
            </div>
          ) : null}

          <h1 className="mt-6 font-[Georgia,'Times_New_Roman',serif] text-4xl leading-[1.05] text-cream sm:text-5xl">
            {displayName}
          </h1>
          {horse.show_name ? (
            <p className="mt-2 text-sm text-cream-dim">Show name: {horse.show_name}</p>
          ) : null}

          {!photoUrl ? (
            <p className="mt-4">
              <Link
                href={`/train/horses/${horse.id}/edit`}
                className="text-[12.5px] tracking-[0.04em] text-cream-dim underline decoration-gold/35 underline-offset-4 hover:text-gold"
              >
                Add a photo of {shortName}
              </Link>
            </p>
          ) : null}

          {detailRows.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-cream-dim">
              {detailRows.slice(0, 6).map(({ label, value }) => (
                <span key={label}>
                  {label}: {value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </AtmosphereScreen>

      {(horse.notes || horse.goals || horse.personality_quirks || horse.injuries_limitations) && (
        <Card className="border-gold/20">
          <CardHeader>
            <CardTitle className="text-base">Notes & goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {horse.notes && (
              <div>
                <p className="font-medium text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{horse.notes}</p>
              </div>
            )}
            {horse.goals && (
              <div>
                <p className="font-medium text-muted-foreground mb-1">Goals</p>
                <p className="whitespace-pre-wrap">{horse.goals}</p>
              </div>
            )}
            {horse.personality_quirks && (
              <div>
                <p className="font-medium text-muted-foreground mb-1">Personality / quirks</p>
                <p className="whitespace-pre-wrap">{horse.personality_quirks}</p>
              </div>
            )}
            {horse.injuries_limitations && (
              <div>
                <p className="font-medium text-muted-foreground mb-1">Injuries or limitations</p>
                <p className="whitespace-pre-wrap">{horse.injuries_limitations}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-gold/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gold" />
              Session history
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Ride logs for this horse</p>
          </div>
          <Link href={`/train/sessions/new?horse_id=${horse.id}`}>
            <Button size="sm" variant="outline">Log session</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {(!sessions || sessions.length === 0) ? (
            <p className="text-muted-foreground py-6 text-center">
              No sessions yet. Log a ride to see it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s: { id: string; session_date: string; session_title?: string | null; session_type: string; duration_minutes?: number | null; overall_feel: number; video_link_url?: string | null; video_upload_path?: string | null }) => (
                <li key={s.id}>
                  <Link
                    href={`/train/sessions/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/10 bg-card p-3 hover:border-gold/30 hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {formatHomeCalendarDate(s.session_date, "MMM d, yyyy")}
                      </span>
                      {s.session_title && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-foreground">{s.session_title}</span>
                        </>
                      )}
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-gold/90">
                        {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                      </span>
                      {s.duration_minutes != null && (
                        <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold font-medium">{s.overall_feel}/10</span>
                      {(s.video_link_url || s.video_upload_path) && (
                        <span className="text-xs text-muted-foreground">Video</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
