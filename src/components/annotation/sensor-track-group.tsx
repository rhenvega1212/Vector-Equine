"use client";

/**
 * One collapsible sensor (§6.1 SensorTrackGroup). A sensor is a *bundle of
 * signals* (§2.3): expanded, it renders one SignalTrack per signal (grouped by
 * displayGroup, honoring focus mode); collapsed, it renders a single summary
 * lane instead of all its signals (§6.3 windowed/scale-down UX).
 *
 * The header carries the manual per-sensor offset nudge (§5) — invaluable for
 * eyeballing sync while hardware matures.
 */
import { useShallow } from "zustand/react/shallow";
import { ChevronDown, ChevronRight, Crosshair, Minus, Plus } from "lucide-react";
import { useAnnotationStore } from "@/lib/annotation/store";
import type { Sensor } from "@/lib/annotation/types";
import { formatPlacement } from "@/lib/annotation/format";
import { LABEL_GUTTER_PX } from "./timeline-context";
import { SignalTrack } from "./signal-track";
import { cn } from "@/lib/utils";

const NUDGE_STEP_MS = 10;

export function SensorTrackGroup({ sensor }: { sensor: Sensor }) {
  const { expanded, focusSignalIds, nudge, baseOffset } = useAnnotationStore(
    useShallow((s) => ({
      expanded: s.sensorLayout[sensor.id]?.expanded ?? false,
      focusSignalIds: s.focusSignalIds,
      nudge: s.perSensorNudgeMs[sensor.id] ?? 0,
      baseOffset: s.sync?.getSensorOffsetMs(sensor.id) ?? sensor.offsetMs,
    }))
  );
  const toggleSensor = useAnnotationStore((s) => s.toggleSensor);
  const nudgeSensor = useAnnotationStore((s) => s.nudgeSensor);
  const setFocus = useAnnotationStore((s) => s.setFocus);

  const focusSet = focusSignalIds ? new Set(focusSignalIds) : null;
  const rawSignals = sensor.signals.filter((s) => s.kind === "raw");
  const derivedSignals = sensor.signals.filter((s) => s.kind === "derived");
  const summarySignal =
    sensor.signals.find((s) => s.key === "movement_magnitude") ?? sensor.signals[0];

  const visibleSignals = (expanded ? sensor.signals : []).filter(
    (s) => !focusSet || focusSet.has(s.id)
  );

  const groups = new Map<string, typeof visibleSignals>();
  for (const sig of visibleSignals) {
    const arr = groups.get(sig.displayGroup) ?? [];
    arr.push(sig);
    groups.set(sig.displayGroup, arr);
  }

  return (
    <div className="border-b border-white/5">
      {/* header */}
      <div className="flex items-stretch bg-white/[0.02]">
        <div
          className="flex shrink-0 items-center gap-1 px-2 py-1.5"
          style={{ width: LABEL_GUTTER_PX }}
        >
          <button
            onClick={() => toggleSensor(sensor.id)}
            className="rounded p-0.5 hover:bg-white/10"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">
              {formatPlacement(sensor.placement)}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {sensor.entity} · {sensor.signals.length} sig
            </div>
          </div>
          <button
            onClick={() => setFocus(sensor.signals.map((s) => s.id))}
            className="rounded p-0.5 text-muted-foreground hover:bg-white/10 hover:text-gold"
            title="Focus this sensor's signals"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* offset nudge control */}
        <div className="flex flex-1 items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground">
          <span className="hidden sm:inline">offset</span>
          <button
            onClick={() => nudgeSensor(sensor.id, -NUDGE_STEP_MS)}
            className="rounded border border-white/10 p-0.5 hover:bg-white/10"
            title={`-${NUDGE_STEP_MS}ms`}
          >
            <Minus className="h-3 w-3" />
          </button>
          <span
            className={cn(
              "tabular-nums",
              nudge !== 0 ? "text-gold" : "text-muted-foreground"
            )}
          >
            {baseOffset >= 0 ? "+" : ""}
            {Math.round(baseOffset)}ms
          </span>
          <button
            onClick={() => nudgeSensor(sensor.id, NUDGE_STEP_MS)}
            className="rounded border border-white/10 p-0.5 hover:bg-white/10"
            title={`+${NUDGE_STEP_MS}ms`}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* collapsed → summary lane */}
      {!expanded && summarySignal && (
        <div className="flex items-stretch">
          <div
            className="flex shrink-0 items-center px-2 text-[10px] text-muted-foreground"
            style={{ width: LABEL_GUTTER_PX }}
          >
            summary · {summarySignal.label}
          </div>
          <div className="flex-1">
            <SignalTrack signal={summarySignal} height={36} summary />
          </div>
        </div>
      )}

      {/* expanded → grouped signal tracks */}
      {expanded &&
        Array.from(groups.entries()).map(([group, sigs]) => (
          <div key={group}>
            {sigs.map((sig) => (
              <div key={sig.id} className="flex items-stretch hover:bg-white/[0.015]">
                <div
                  className="flex shrink-0 flex-col justify-center px-2 py-0.5"
                  style={{ width: LABEL_GUTTER_PX }}
                >
                  <span className="truncate text-[11px]">{sig.label}</span>
                  <span className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">
                    {sig.kind === "derived" ? "derived" : sig.displayGroup} · {sig.unit}
                  </span>
                </div>
                <div className="flex-1">
                  <SignalTrack signal={sig} />
                </div>
              </div>
            ))}
          </div>
        ))}

      {expanded && visibleSignals.length === 0 && (
        <div
          className="py-2 text-center text-[10px] text-muted-foreground"
          style={{ paddingLeft: LABEL_GUTTER_PX }}
        >
          {focusSet
            ? "No focused signals on this sensor."
            : `${rawSignals.length} raw · ${derivedSignals.length} derived hidden`}
        </div>
      )}
    </div>
  );
}
