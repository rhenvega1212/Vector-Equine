"use client";

import { formatOffset } from "@/lib/capture/summary";
import { DebriefComingSoon } from "@/components/train/debrief-coming-soon";

export type BriefCue = {
  offset_ms: number;
  text: string;
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
  const storyParagraphs = (story || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  // First paragraph may be focus when end route prepended it
  const focusLine =
    focus ||
    (storyParagraphs.length > 1 && storyParagraphs[0].length < 160
      ? storyParagraphs[0]
      : null);
  const bodyParagraphs =
    focusLine && storyParagraphs[0] === focusLine
      ? storyParagraphs.slice(1)
      : storyParagraphs;

  const exerciseLines = (exercises || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="space-y-8">
      {focusLine && (
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

      {!focusLine && trainerName && (
        <p className="text-sm text-cream/55">Lesson with {trainerName}</p>
      )}

      {isComms && (
        <DebriefComingSoon
          title="Execution score"
          promise="A real score appears when sensors or hybrid capture are connected — not invented from audio alone."
        />
      )}

      {bodyParagraphs.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Lesson story
          </p>
          <div className="space-y-3">
            {bodyParagraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-cream/85">
                {p}
              </p>
            ))}
          </div>
        </section>
      )}

      {cues.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Coach cue reel
          </p>
          <ul className="space-y-2">
            {cues.map((c, i) => (
              <li key={`${c.offset_ms}-${i}`}>
                <button
                  type="button"
                  onClick={() => onJumpTimeline?.(c.offset_ms)}
                  className="w-full rounded-lg border border-gold/15 bg-[#131C31] px-3 py-3 text-left transition hover:border-gold/35"
                >
                  <span className="tabular-nums text-gold/80">
                    {formatOffset(c.offset_ms)}
                  </span>
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-gold">
                    {trainerName || "trainer"}
                  </span>
                  <p className="mt-1 text-sm text-cream/90">{c.text}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cues.length === 0 && isComms && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Coach cue reel
          </p>
          <p className="text-sm text-cream/45">
            No trainer cues on the timeline yet. When your trainer&apos;s mic and
            speech are on, their lines land here.
          </p>
        </section>
      )}

      {exerciseLines.length > 0 && (
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

      {homework && (
        <section className="space-y-2 border-t border-gold/15 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Homework / next ride
          </p>
          <p className="text-sm leading-relaxed text-cream/90">{homework}</p>
        </section>
      )}

      <div className="space-y-3 border-t border-gold/10 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cream/40">
          Pipeline
        </p>
        <DebriefComingSoon
          title="Your ride, decoded"
          promise="Timestamped moments from video and sensors — when those connect."
        />
        <DebriefComingSoon
          title="Aid consistency"
          promise="Aid timing and symmetry metrics from sensor capture."
        />
        <DebriefComingSoon
          title="Health note"
          promise="Calm flags only — never a diagnosis. Available with richer capture."
        />
        <DebriefComingSoon
          title="Plan vs ridden"
          promise="Compare today’s Plan intent to what showed up in the lesson."
        />
        <DebriefComingSoon
          title="Media"
          promise="Clips synced to the timeline from session media assets."
        />
      </div>
    </div>
  );
}
