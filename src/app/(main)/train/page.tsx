import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SESSION_TYPE_LABELS } from "@/lib/validations/training-session";
import { HorseSwitcher } from "@/components/train/horse-switcher";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";
import { HomeStartDial } from "@/components/train/home-start-dial";
import {
  sessionDisplayTitle,
} from "@/lib/train/format-session-when";
import { formatInHomeTz } from "@/lib/timezone";
import {
  isBriefPending,
  parseCoachCardSummary,
} from "@/lib/capture/transcript-cleanup";
import { CoachShareApproval } from "@/components/train/coach-share-approval";

interface VectorHomeProps {
  searchParams: Promise<{ horseId?: string }>;
}

function firstSentence(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const part = text.split(/\.|\n/)[0]?.trim();
  return part || null;
}

/** Soften ALL-CAPS blobs into sentence case for reading. */
function readableCopy(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const letters = t.replace(/[^A-Za-z]/g, "");
  const hasLower = /[a-z]/.test(letters);
  const upperRatio = letters
    ? (letters.match(/[A-Z]/g) || []).length / letters.length
    : 0;
  if (hasLower && upperRatio < 0.6) return t;
  const lower = t.toLowerCase();
  return lower.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase());
}

function horseMetaLine(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean)
    .join(" · ");
}

type SessionRow = {
  id: string;
  session_date: string;
  created_at: string;
  overall_feel: number | null;
  horse: string | null;
  horse_id: string | null;
  session_type: string;
  session_title: string | null;
  summary: string | null;
  homework: string | null;
  notes: string | null;
};

/**
 * North-star line for THE WORK — complete phrase, never mid-thought chop.
 * Prefer text before : or — when the source packed theme + detail together.
 */
function northStarPhrase(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  const beforeColon = cleaned.split(":")[0]?.trim();
  if (
    beforeColon &&
    beforeColon.length >= 8 &&
    beforeColon.length < cleaned.length
  ) {
    return beforeColon;
  }

  const emSplit = cleaned.split(/\s+[—–-]\s+/);
  if (emSplit[0] && emSplit.length > 1 && emSplit[0].trim().length >= 8) {
    return emSplit[0].trim();
  }

  // Long legacy focus: keep first clause, not a word-count stump
  if (cleaned.length > 90) {
    const clause = cleaned.split(/[.;]/)[0]?.trim();
    if (clause && clause.length >= 8) return clause;
  }

  return cleaned.replace(/[:;—–-]+$/g, "").trim();
}

/** THE WORK — north star (serif) + next-ride instruction (italic). */
function workFromLastSession(sessions: SessionRow[]): {
  value: string;
  italic: string | null;
} | null {
  const session =
    sessions.find((s) => s.summary?.trim() && !isBriefPending(s.summary)) ||
    sessions.find((s) => s.session_title?.trim() || s.homework?.trim());

  if (!session) return null;

  const parsed = parseCoachCardSummary(session.summary);
  const rawNorth =
    session.session_title?.trim() ||
    parsed.focus?.trim() ||
    null;
  if (!rawNorth && !session.homework?.trim()) return null;

  const value = rawNorth
    ? readableCopy(northStarPhrase(rawNorth))
    : null;

  const homework = session.homework?.trim() || null;
  let italic: string | null = null;
  if (homework) {
    const hw = readableCopy(homework);
    if (!value || hw.toLowerCase() !== value.toLowerCase()) {
      italic = hw;
    }
  }

  // Need at least one beat
  if (!value && !italic) return null;

  // If we only have homework, use a short north star from it and keep full italic
  if (!value && italic) {
    return {
      value: readableCopy(northStarPhrase(italic)),
      italic: italic.length > 40 ? italic : null,
    };
  }

  return { value: value!, italic };
}

export default async function VectorHomePage({ searchParams }: VectorHomeProps) {
  const { horseId: horseIdParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, active_horse_id")
    .eq("id", user.id)
    .single();

  const firstName =
    profile?.display_name?.trim().split(/\s+/)[0] || "there";

  const { data: horses, error: horsesError } = await supabase
    .from("horse_profiles")
    .select(
      "id, name, barn_name, discipline, training_level, breed, age, profile_photo_url"
    )
    .eq("user_id", user.id)
    .order("name");

  const horseList = horsesError ? [] : horses || [];
  const activeHorse =
    horseList.find((h) => h.id === horseIdParam) ||
    horseList.find((h) => h.id === profile?.active_horse_id) ||
    horseList[0] ||
    null;

  if (!activeHorse) {
    return (
      <AtmosphereScreen className="min-h-[70vh] px-7 pt-4 sm:pt-5">
        <header className="space-y-1">
          <h1 className="font-[Georgia,'Times_New_Roman',serif] text-3xl text-cream sm:text-4xl">
            Welcome, {firstName}.
          </h1>
        </header>
        <section className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
            Step 1 · Setup
          </p>
          <h2 className="mt-4 font-[Georgia,'Times_New_Roman',serif] text-2xl text-cream sm:text-3xl">
            Set up your horse
          </h2>
          <p className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-lg italic text-gold">
            Vector starts with a baseline for you and your horse.
          </p>
          <div className="mt-6">
            <Button
              className="bg-gold font-semibold text-navy hover:bg-gold-bright"
              asChild
            >
              <Link href="/train/setup">Continue setup</Link>
            </Button>
          </div>
        </section>
      </AtmosphereScreen>
    );
  }

  const { data: sessions } = await supabase
      .from("training_sessions")
      .select(
        "id, session_date, created_at, overall_feel, horse, horse_id, session_type, session_title, summary, homework, notes"
      )
      .eq("user_id", user.id)
      .eq("is_test", false)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  const list = (sessions || []).filter(
    (s) => !s.horse_id || s.horse_id === activeHorse.id
  ) as SessionRow[];
  const recent = list.slice(0, 3);

  const work = workFromLastSession(list);

  // NOTICED — story from last brief (not the focus line, which is THE WORK)
  const noticedSession =
    list.find((s) => s.summary?.trim() && !isBriefPending(s.summary)) || null;
  const noticedParsed = noticedSession
    ? parseCoachCardSummary(noticedSession.summary)
    : null;
  const insightRaw =
    firstSentence(noticedParsed?.story) ||
    noticedParsed?.corrections[0]?.text ||
    null;
  const insightLine = insightRaw ? readableCopy(insightRaw) : null;

  const displayName = activeHorse.barn_name?.trim() || activeHorse.name;
  const planHref = `/train/ride/plan?horseId=${activeHorse.id}`;
  const liveHref = `/train/ride/live?horseId=${activeHorse.id}`;

  const dateLine = formatInHomeTz(new Date(), "EEEE · MMM d").toUpperCase();

  const meta = horseMetaLine([
    activeHorse.age,
    activeHorse.breed,
    activeHorse.training_level || activeHorse.discipline,
  ]).toUpperCase();

  const score = (feel: number | null | undefined) =>
    feel == null ? null : Number(feel).toFixed(1);

  const photoUrl = activeHorse.profile_photo_url?.trim() || null;

  const { data: pendingConnections } = await supabase
    .from("coach_connections")
    .select(
      `
      id,
      created_at,
      trainer:profiles!coach_connections_trainer_id_fkey (
        display_name
      )
    `
    )
    .eq("rider_id", user.id)
    .eq("status", "pending")
    .eq("initiated_by", "capture")
    .order("created_at", { ascending: false });

  const pendingApprovals = (pendingConnections || []).map((c) => {
    const trainer = c.trainer as { display_name?: string } | null;
    const when = c.created_at
      ? `on ${formatInHomeTz(c.created_at, "MMM d")}`
      : null;
    return {
      id: c.id,
      trainerName: trainer?.display_name?.trim() || "Your coach",
      lessonHint: when,
    };
  });

  return (
    <AtmosphereScreen className="min-h-[70vh]" heroImageUrl={photoUrl}>
      <div className="px-7 pt-4 sm:pt-5">
        {/* Header — say it once */}
        <div className="mb-10">
          <span className="text-[10px] uppercase tracking-[0.28em] text-gold">
            {dateLine}
          </span>
        </div>

        <h1
          className="m-0 font-[Georgia,'Times_New_Roman',serif] text-[62px] font-normal leading-[0.98] text-cream"
          style={{ overflowWrap: "anywhere" }}
        >
          {displayName}
        </h1>

        {meta ? (
          <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-cream-dim">
            {meta}
          </p>
        ) : null}

        <div className="mt-3">
          <HorseSwitcher
            variant="link"
            horses={horseList.map((h) => ({
              id: h.id,
              name: h.barn_name?.trim() || h.name,
              level: h.training_level || h.discipline,
            }))}
            activeId={activeHorse.id}
          />
        </div>

        {!photoUrl ? (
          <p className="mt-4">
            <Link
              href={`/train/horses/${activeHorse.id}/edit`}
              className="text-[12.5px] tracking-[0.04em] text-cream-dim underline decoration-gold/35 underline-offset-4 hover:text-gold"
            >
              Add a photo of {displayName}
            </Link>
          </p>
        ) : null}

        <div className="h-[30px]" />
        <hr className="m-0 h-px border-0 bg-[var(--line)]" />

        {work ? (
          <div className="mt-[30px]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
              The work
            </p>
            <p className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-[29px] leading-[1.25] text-cream">
              {work.value}
            </p>
            {work.italic ? (
              <p className="mt-[11px] font-[Georgia,'Times_New_Roman',serif] text-[15.5px] italic text-gold">
                {work.italic}
              </p>
            ) : null}
          </div>
        ) : null}

        <HomeStartDial horseName={displayName} liveHref={liveHref} />

        <div className="mt-6 text-center">
          <Link
            href={planHref}
            className="text-[12.5px] tracking-[0.04em] text-gold hover:text-gold-bright"
          >
            Or plan it first →
          </Link>
        </div>
      </div>

      {pendingApprovals.length > 0 ? (
        <div className="mt-8">
          <CoachShareApproval pending={pendingApprovals} />
        </div>
      ) : null}

      {/* Cream reading zone — hard cut, no gradient */}
      <div
        className="relative z-[7] mt-[86px] bg-cream pb-8 pt-[54px] text-ink"
        style={{
          // Clear Vector nav + safe area
          paddingBottom:
            "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "rgba(209,169,85,.28)" }}
          aria-hidden
        />

        {insightLine ? (
          <>
            <div className="px-7">
              <p
                className="mb-3.5 text-[10px] uppercase tracking-[0.28em]"
                style={{ color: "#8A6D2F" }}
              >
                Noticed
              </p>
              <div
                className="border-l border-[#C9A24A] pl-[15px]"
              >
                <p
                  className="m-0 text-[13.5px] leading-[1.65]"
                  style={{ color: "#2A3040" }}
                >
                  {insightLine}.
                </p>
              </div>
              <div className="mt-3.5">
                <Link
                  href={planHref}
                  className="text-[12.5px] tracking-[0.04em] hover:opacity-80"
                  style={{ color: "#9A7526" }}
                >
                  Work on it →
                </Link>
              </div>
            </div>
            <div className="h-[34px]" />
            <div
              className="text-center text-[8px] tracking-[0.6em] opacity-50"
              style={{ color: "#C9A24A" }}
              aria-hidden
            >
              ◇
            </div>
            <div className="h-7" />
          </>
        ) : null}

        {recent.length > 0 ? (
          <>
            <div className="h-[34px]" />
            <div
              className="text-center text-[8px] tracking-[0.6em] opacity-50"
              style={{ color: "#C9A24A" }}
              aria-hidden
            >
              ◇
            </div>
            <div className="h-7" />
            <div className="px-7">
              <p
                className="mb-2 text-[10px] uppercase tracking-[0.28em]"
                style={{ color: "#8A6D2F" }}
              >
                Last rides
              </p>
              <hr
                className="m-0 h-px border-0"
                style={{ background: "rgba(26,33,51,.14)" }}
              />
              {recent.map((s) => (
                <div key={s.id}>
                  <Link
                    href={`/train/sessions/${s.id}`}
                    className="flex items-baseline justify-between py-4"
                  >
                    <span
                      className="text-[13.5px]"
                      style={{ color: "#1A2133" }}
                    >
                      {sessionDisplayTitle(
                        s.session_title,
                        s.notes?.split(" — ")[0]?.trim() ||
                          SESSION_TYPE_LABELS[s.session_type] ||
                          s.session_type
                      )}
                    </span>
                    <span
                      className="font-[Georgia,'Times_New_Roman',serif] text-sm"
                      style={{ color: "#9A7526" }}
                    >
                      {score(s.overall_feel) ?? ""}
                    </span>
                  </Link>
                  <hr
                    className="m-0 h-px border-0"
                    style={{ background: "rgba(26,33,51,.14)" }}
                  />
                </div>
              ))}
              <div className="mt-6 text-center">
                <Link
                  href={`/train/sessions?horse_id=${activeHorse.id}&range=all`}
                  className="text-[12.5px] tracking-[0.04em] hover:opacity-80"
                  style={{ color: "#9A7526" }}
                >
                  All rides →
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AtmosphereScreen>
  );
}
