"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatOffset } from "@/lib/capture/summary";

export type TimelineSegment = {
  id: string;
  offset_ms: number;
  ended_offset_ms: number | null;
  speaker: string;
  text: string;
};

export function DebriefCaptureTabs({
  journal,
  timeline,
}: {
  journal: React.ReactNode;
  timeline: TimelineSegment[];
}) {
  const [tab, setTab] = useState<"journal" | "timeline">(
    timeline.length > 0 ? "journal" : "journal"
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-gold/15 bg-[#131C31] p-1">
        <TabButton active={tab === "journal"} onClick={() => setTab("journal")}>
          Journal
        </TabButton>
        <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
          Timeline
          {timeline.length > 0 ? ` (${timeline.length})` : ""}
        </TabButton>
      </div>

      {tab === "journal" ? (
        journal
      ) : (
        <div className="space-y-3 rounded-xl border border-gold/15 bg-[#131C31] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Timestamped transcript
          </p>
          <p className="text-xs text-cream/45">
            Builder view — sync video and sensors to these offsets later.
          </p>
          {timeline.length === 0 ? (
            <p className="text-sm text-cream/50">No transcript segments for this ride.</p>
          ) : (
            <ul className="space-y-3">
              {timeline.map((s) => (
                <li key={s.id} className="border-b border-gold/10 pb-3 last:border-0">
                  <div className="flex items-baseline gap-2">
                    <span className="tabular-nums text-sm text-gold/90">
                      {formatOffset(s.offset_ms)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-cream/40">
                      {s.speaker}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-cream/90">{s.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
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
