"use client";

/** TransportControls (§6.1): play/pause, speed, frame-step, zoom + time readout. */
import { useShallow } from "zustand/react/shallow";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnotationStore } from "@/lib/annotation/store";
import { formatMs } from "@/lib/annotation/format";

const FRAME_MS = 1000 / 30;
const SPEEDS = [0.25, 0.5, 1, 2] as const;

export function TransportControls() {
  const {
    isPlaying,
    playbackRate,
    currentMs,
    durationMs,
    startMs,
    endMs,
  } = useAnnotationStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      playbackRate: s.playbackRate,
      currentMs: s.currentMs,
      durationMs: s.durationMs,
      startMs: s.visibleWindow.startMs,
      endMs: s.visibleWindow.endMs,
    }))
  );
  const togglePlay = useAnnotationStore((s) => s.togglePlay);
  const setPlaybackRate = useAnnotationStore((s) => s.setPlaybackRate);
  const requestSeek = useAnnotationStore((s) => s.requestSeek);
  const zoom = useAnnotationStore((s) => s.zoom);
  const setVisibleWindow = useAnnotationStore((s) => s.setVisibleWindow);

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(playbackRate as (typeof SPEEDS)[number]);
    setPlaybackRate(SPEEDS[(idx + 1) % SPEEDS.length]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-navy p-2">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => requestSeek(0)} title="Start">
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => requestSeek(currentMs - FRAME_MS)}
        title="Frame back"
      >
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        className="h-9 w-9 bg-gold text-navy hover:bg-gold/90"
        onClick={togglePlay}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => requestSeek(currentMs + FRAME_MS)}
        title="Frame forward"
      >
        <SkipForward className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => requestSeek(durationMs)} title="End">
        <ChevronsRight className="h-4 w-4" />
      </Button>

      <button
        onClick={cycleSpeed}
        className="rounded border border-white/10 px-2 py-1 text-xs tabular-nums hover:bg-white/10"
        title="Playback speed"
      >
        {playbackRate}×
      </button>

      <div className="ml-1 font-mono text-xs tabular-nums text-foreground">
        {formatMs(currentMs)}{" "}
        <span className="text-muted-foreground">/ {formatMs(durationMs)}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => zoom(1 / 1.5)} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => zoom(1.5)} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setVisibleWindow({ startMs: 0, endMs: durationMs })}
          title="Fit all"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <span className="ml-1 text-[10px] text-muted-foreground">
          view {formatMs(startMs, true)}–{formatMs(endMs, true)}
        </span>
      </div>
    </div>
  );
}
