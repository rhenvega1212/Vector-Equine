"use client";

import { formatOffset } from "@/lib/capture/summary";
import { DebriefComingSoon } from "@/components/train/debrief-coming-soon";
import {
  RIDER_HIGHLIGHTS_END,
  RIDER_HIGHLIGHTS_START,
} from "@/lib/capture/transcript-cleanup";

export type BriefCue = {
  offset_ms: number;
  text: string;
  featured?: boolean;
};

function splitRiderMarks(story: string | null): {
  storyBody: string | null;
  riderMarks: string | null;
} {
  if (!story?.trim()) return { storyBody: null, riderMarks: null };
  const start = story.indexOf(RIDER_HIGHLIGHTS_START);
  const end = story.indexOf(RIDER_HIGHLIGHTS_END);
  if (start === -1 || end === -1 || end < start) {
    return { storyBody: story.trim(), riderMarks: null };
  }
  const before = story.slice(0, start).trim();
  const mid = story
    .slice(start + RIDER_HIGHLIGHTS_START.length, end)
    .trim()
    .replace(/^What you marked as valuable:\s*/i, "");
  const after = story.slice(end + RIDER_HIGHLIGHTS_END.length).trim();
  const storyBody = [before, after].filter(Boolean).join("\n\n") || null;
  return { storyBody, riderMarks: mid || null };
}

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
  const { storyBody, riderMarks } = splitRiderMarks(story);
  const storyParagraphs = (storyBody || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
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

  const featuredQuotes = cues.filter((c) => c.featured);
  const quoteReel = featuredQuotes.length > 0 ? featuredQuotes : cues.slice(0, 6);

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

      {quoteReel.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Coach quotes
          </p>
          <p className="text-xs text-cream/45">
            Direct lines from {trainerName || "your trainer"} — tap to jump the
            timeline.
          </p>
          <ul className="space-y-3">
            {quoteReel.map((c, i) => (
              <li key={`${c.offset_ms}-${i}`}>
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

      {quoteReel.length === 0 && isComms && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Coach quotes
          </p>
          <p className="text-sm text-cream/45">
            Valuable trainer lines will land here after End cleans the
            transcript. You can also star moments on the Timeline.
          </p>
        </section>
      )}

      {riderMarks && (
        <section className="space-y-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            What you marked
          </p>
          <p className="text-xs text-cream/50">
            Moments you starred on the timeline — folded into this brief.
          </p>
          <div className="space-y-2 whitespace-pre-wrap text-sm leading-relaxed text-cream/90">
            {riderMarks}
          </div>
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
