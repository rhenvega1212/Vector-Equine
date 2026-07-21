"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatOffset } from "@/lib/capture/summary";
import {
  DebriefJournalBrief,
  type BriefCue,
} from "@/components/train/debrief-journal-brief";
import { VectorRideChat } from "@/components/train/vector-ride-chat";

export type TimelineSegment = {
  id: string;
  offset_ms: number;
  ended_offset_ms: number | null;
  speaker: string;
  text: string;
};

export function DebriefCaptureClient({
  sessionId,
  focus,
  story,
  homework,
  exercises,
  cues,
  trainerName,
  isComms,
  timeline,
  showChat,
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
}) {
  const [tab, setTab] = useState<"journal" | "timeline">("journal");
  const [highlightMs, setHighlightMs] = useState<number | null>(null);

  function jumpToTimeline(offsetMs: number) {
    setHighlightMs(offsetMs);
    setTab("timeline");
  }

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

      {tab === "journal" ? (
        <DebriefJournalBrief
          focus={focus}
          story={story}
          homework={homework}
          exercises={exercises}
          cues={cues}
          trainerName={trainerName}
          isComms={isComms}
          onJumpTimeline={jumpToTimeline}
        />
      ) : (
        <div className="space-y-3 rounded-xl border border-gold/15 bg-[#131C31] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Conversation timeline
          </p>
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
                return (
                  <li
                    key={s.id}
                    id={`cue-${s.offset_ms}`}
                    className={cn(
                      "border-b border-gold/10 pb-3 last:border-0",
                      active && "rounded-lg bg-gold/10 px-2 -mx-2"
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="tabular-nums text-sm text-gold/90">
                        {formatOffset(s.offset_ms)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-cream/40">
                        {s.speaker === "trainer"
                          ? trainerName || "trainer"
                          : s.speaker}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-cream/90">{s.text}</p>
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
