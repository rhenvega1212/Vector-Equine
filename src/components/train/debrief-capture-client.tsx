"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatOffset } from "@/lib/capture/summary";
import {
  DebriefJournalBrief,
  type BriefCue,
} from "@/components/train/debrief-journal-brief";
import { VectorRideChatLazy as VectorRideChat } from "@/components/train/vector-ride-chat-lazy";
import { Star } from "lucide-react";

export type TimelineSegment = {
  id: string;
  offset_ms: number;
  ended_offset_ms: number | null;
  speaker: string;
  text: string;
  rider_highlight?: boolean;
  featured_quote?: boolean;
};

export function DebriefCaptureClient({
  sessionId,
  focus,
  story: storyProp,
  homework,
  exercises,
  cues,
  trainerName,
  isComms,
  timeline: timelineProp,
  showChat,
  canHighlight,
}: {
  sessionId: string;
  focus: string | null;
  story: string | null;
  homework: string | null;
  exercises: string | null;
  cues: BriefCue[];
  trainerName: string | null;
  isComms: boolean;
  timeline: TimelineSegment[];
  showChat: boolean;
  canHighlight?: boolean;
}) {
  const [tab, setTab] = useState<"journal" | "timeline">("journal");
  const [highlightMs, setHighlightMs] = useState<number | null>(null);
  const [timeline, setTimeline] = useState(timelineProp);
  const [story, setStory] = useState(storyProp);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const liveCues = useMemo<BriefCue[]>(() => {
    const featured = timeline
      .filter((s) => s.speaker === "trainer" && s.featured_quote)
      .map((s) => ({
        offset_ms: s.offset_ms,
        text: s.text,
        featured: true as const,
      }));
    if (featured.length > 0) return featured;
    return cues;
  }, [timeline, cues]);

  function jumpToTimeline(offsetMs: number) {
    setHighlightMs(offsetMs);
    setTab("timeline");
  }

  async function toggleHighlight(seg: TimelineSegment) {
    if (!canHighlight) return;
    setBusyId(seg.id);
    setToast(null);
    const next = !seg.rider_highlight;
    try {
      const res = await fetch(`/api/train/sessions/${sessionId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_id: seg.id,
          highlighted: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Could not save highlight");
        return;
      }
      setTimeline((prev) =>
        prev.map((s) =>
          s.id === seg.id ? { ...s, rider_highlight: next } : s
        )
      );
      if (typeof data.summary === "string") {
        setStory(data.summary);
      }
      setToast(
        next
          ? "Saved to What you marked — open Journal to see it in the brief."
          : "Removed from your marks."
      );
    } catch {
      setToast("Could not save highlight");
    } finally {
      setBusyId(null);
    }
  }

  const markedCount = timeline.filter((s) => s.rider_highlight).length;

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl border border-gold/15 bg-[#131C31] p-1">
        <TabButton active={tab === "journal"} onClick={() => setTab("journal")}>
          Journal
        </TabButton>
        <TabButton
          active={tab === "timeline"}
          onClick={() => setTab("timeline")}
        >
          Timeline
          {timeline.length > 0 ? ` (${timeline.length})` : ""}
        </TabButton>
      </div>

      {toast && (
        <p className="rounded-lg border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-cream/80">
          {toast}
        </p>
      )}

      {tab === "journal" ? (
        <DebriefJournalBrief
          focus={focus}
          story={story}
          homework={homework}
          exercises={exercises}
          cues={liveCues}
          trainerName={trainerName}
          isComms={isComms}
          onJumpTimeline={jumpToTimeline}
        />
      ) : (
        <div className="space-y-3 rounded-xl border border-gold/15 bg-[#131C31] p-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Conversation timeline
            </p>
            {canHighlight && (
              <p className="text-xs text-cream/50">
                Tap the star on lines that mattered — they fold into{" "}
                <span className="text-cream/70">What you marked</span> on the
                Journal
                {markedCount > 0 ? ` (${markedCount} saved)` : ""}.
              </p>
            )}
          </div>
          {timeline.length === 0 ? (
            <p className="text-sm text-cream/50">
              No transcript segments for this ride yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {timeline.map((s) => {
                const active =
                  highlightMs != null &&
                  Math.abs(s.offset_ms - highlightMs) < 500;
                const starred = !!s.rider_highlight;
                return (
                  <li
                    key={s.id}
                    id={`cue-${s.offset_ms}`}
                    className={cn(
                      "border-b border-gold/10 pb-3 last:border-0",
                      active && "rounded-lg bg-gold/10 px-2 -mx-2",
                      starred && "rounded-lg bg-gold/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="tabular-nums text-sm text-gold/90">
                            {formatOffset(s.offset_ms)}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-cream/40">
                            {s.speaker === "trainer"
                              ? trainerName || "trainer"
                              : s.speaker}
                          </span>
                          {s.featured_quote && (
                            <span className="text-[10px] uppercase tracking-wider text-gold">
                              coach quote
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "mt-1 text-sm text-cream/90",
                            s.featured_quote && "font-serif text-base"
                          )}
                        >
                          {s.featured_quote ? `“${s.text}”` : s.text}
                        </p>
                      </div>
                      {canHighlight && (
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => void toggleHighlight(s)}
                          aria-label={
                            starred ? "Remove highlight" : "Mark as valuable"
                          }
                          className={cn(
                            "mt-0.5 shrink-0 rounded-md border p-1.5 transition",
                            starred
                              ? "border-gold bg-gold/20 text-gold"
                              : "border-gold/20 text-cream/35 hover:border-gold/40 hover:text-gold"
                          )}
                        >
                          <Star
                            className="h-4 w-4"
                            fill={starred ? "currentColor" : "none"}
                          />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {showChat && (
        <VectorRideChat
          sessionId={sessionId}
          trainerName={trainerName}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
        active ? "bg-gold text-navy" : "text-cream/55 hover:text-cream"
      )}
    >
      {children}
    </button>
  );
}
