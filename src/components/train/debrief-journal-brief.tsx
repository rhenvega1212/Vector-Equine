"use client";

import { formatOffset } from "@/lib/capture/summary";
import { parseCoachCardSummary } from "@/lib/capture/transcript-cleanup";

export type BriefCue = {
  offset_ms: number;
  text: string;
  featured?: boolean;
};

export function DebriefJournalBrief({
  focus,
  story,
  homework,
  exercises,
  cues,
  trainerName,
  isComms,
  onJumpTimeline,
}: {
  focus: string | null;
  story: string | null;
  homework: string | null;
  exercises: string | null;
  cues: BriefCue[];
  trainerName: string | null;
  isComms: boolean;
  onJumpTimeline?: (offsetMs: number) => void;
}) {
  // Prefer full structured summary when markers are present (avoids duplicating focus)
  const rawForParse =
    story &&
    /<<<(?:brief_pending|corrections|keeps|rider_highlights)>>>/.test(story)
      ? story
      : [focus, story].filter(Boolean).join("\n\n");
  const parsed = parseCoachCardSummary(rawForParse || null);

  const focusLine = parsed.focus || focus;
  const storyBody = parsed.story;
  const storyParagraphs = (storyBody || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const exerciseLines = (exercises || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Corrections: structured block first, then featured cues only (never first-N dump)
  const correctionCues: BriefCue[] =
    parsed.corrections.length > 0
      ? parsed.corrections.map((c) => ({ ...c, featured: true }))
      : cues.filter((c) => c.featured);

  const keepCues: BriefCue[] =
    parsed.keeps.length > 0
      ? parsed.keeps.map((c) => ({ ...c, featured: true }))
      : [];

  return (
    <div className="space-y-8">
      {parsed.pending && (
        <section className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Writing brief
          </p>
          <p className="text-sm text-cream/80">
            Vector is cleaning the transcript and writing your coach card. This
            page will update when it&apos;s ready — or refresh in a moment.
          </p>
        </section>
      )}

      {focusLine && !parsed.pending && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Today&apos;s focus
          </p>
          <p className="font-serif text-2xl leading-snug text-cream sm:text-3xl">
            {focusLine}
          </p>
          {trainerName && (
            <p className="text-sm text-cream/50">Lesson with {trainerName}</p>
          )}
        </section>
      )}

      {!focusLine && !parsed.pending && trainerName && (
        <p className="text-sm text-cream/55">Lesson with {trainerName}</p>
      )}

      {!parsed.pending && correctionCues.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Corrections that mattered
          </p>
          <p className="text-xs text-cream/45">
            Coaching cues from {trainerName || "your trainer"} — tap to jump the
            timeline.
          </p>
          <ul className="space-y-3">
            {correctionCues.map((c, i) => (
              <li key={`corr-${c.offset_ms}-${i}`}>
                <button
                  type="button"
                  onClick={() => onJumpTimeline?.(c.offset_ms)}
                  className="w-full rounded-lg border border-gold/20 bg-[#131C31] px-4 py-3 text-left transition hover:border-gold/40"
                >
                  <span className="tabular-nums text-xs text-gold/80">
                    {formatOffset(c.offset_ms)}
                  </span>
                  <p className="mt-2 font-serif text-lg leading-snug text-cream">
                    “{c.text}”
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!parsed.pending && keepCues.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            What improved
          </p>
          <ul className="space-y-3">
            {keepCues.map((c, i) => (
              <li key={`keep-${c.offset_ms}-${i}`}>
                <button
                  type="button"
                  onClick={() => onJumpTimeline?.(c.offset_ms)}
                  className="w-full rounded-lg border border-gold/15 bg-[#131C31]/80 px-4 py-3 text-left transition hover:border-gold/35"
                >
                  <span className="tabular-nums text-xs text-gold/70">
                    {formatOffset(c.offset_ms)}
                  </span>
                  <p className="mt-2 text-sm leading-snug text-cream/90">
                    “{c.text}”
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!parsed.pending && storyParagraphs.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Lesson notes
          </p>
          <div className="space-y-3">
            {storyParagraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-cream/85">
                {p}
              </p>
            ))}
          </div>
        </section>
      )}

      {!parsed.pending &&
        correctionCues.length === 0 &&
        isComms && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Corrections that mattered
            </p>
            <p className="text-sm text-cream/45">
              When Vector finishes the brief, the coaching corrections that
              mattered will show here.
            </p>
          </section>
        )}

      {parsed.riderMarks && (
        <section className="space-y-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            What you marked
          </p>
          <p className="text-xs text-cream/50">
            Moments you starred on the timeline.
          </p>
          <div className="space-y-2 whitespace-pre-wrap text-sm leading-relaxed text-cream/90">
            {parsed.riderMarks}
          </div>
        </section>
      )}

      {!parsed.pending && exerciseLines.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Key work
          </p>
          <ul className="flex flex-wrap gap-2">
            {exerciseLines.map((ex) => (
              <li
                key={ex}
                className="rounded-full border border-gold/20 px-3 py-1 text-xs text-cream/80"
              >
                {ex}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!parsed.pending && homework && (
        <section className="space-y-2 border-t border-gold/15 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Homework / next ride
          </p>
          <p className="text-sm leading-relaxed text-cream/90">{homework}</p>
        </section>
      )}
    </div>
  );
}
