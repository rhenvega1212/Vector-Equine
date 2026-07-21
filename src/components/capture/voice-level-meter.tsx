"use client";

import { useEffect, useRef, useState } from "react";
import { createAudioAnalyser, type LocalAudioTrack } from "livekit-client";
import { cn } from "@/lib/utils";

const BAR_COUNT = 24;

/**
 * Live mic level graphic — bars react to real audio input so you can see
 * Vector is actually picking up your voice (not just a static "Live" badge).
 */
export function VoiceLevelMeter({
  track,
  muted,
  className,
}: {
  track: LocalAudioTrack | null;
  muted?: boolean;
  className?: string;
}) {
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.08));
  const [hearing, setHearing] = useState(false);
  const levelsRef = useRef<number[]>(Array(BAR_COUNT).fill(0.08));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!track || muted) {
      levelsRef.current = Array(BAR_COUNT).fill(0.08);
      setBars([...levelsRef.current]);
      setHearing(false);
      return;
    }

    let cleanup: (() => Promise<void>) | null = null;
    let cancelled = false;

    try {
      const helper = createAudioAnalyser(track, {
        fftSize: 256,
        smoothingTimeConstant: 0.65,
      });
      cleanup = helper.cleanup;
      const { analyser, calculateVolume } = helper;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(data);
        const volume = calculateVolume(); // 0–1
        const hearingNow = volume > 0.04;
        setHearing(hearingNow);

        const next = levelsRef.current.map((_, i) => {
          // Sample across the lower/mid spectrum where voice lives
          const bin = Math.min(
            data.length - 1,
            Math.floor((i / BAR_COUNT) * data.length * 0.55) + 2
          );
          const raw = (data[bin] ?? 0) / 255;
          // Blend with overall volume so quiet speech still moves the middle
          const target = Math.max(0.06, Math.min(1, raw * 0.75 + volume * 1.1));
          const prev = levelsRef.current[i] ?? 0.08;
          return prev * 0.45 + target * 0.55;
        });
        levelsRef.current = next;
        setBars([...next]);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setHearing(false);
    }

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      void cleanup?.();
    };
  }, [track, muted]);

  const label = muted
    ? "Mic off"
    : !track
      ? "Waiting for mic…"
      : hearing
        ? "Hearing you"
        : "Speak to test — bars should move";

  return (
    <div
      className={cn(
        "rounded-xl border border-gold/20 bg-navy/60 px-3 py-3",
        className
      )}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/45">
          Voice input
        </p>
        <p
          className={cn(
            "text-[11px] font-medium",
            muted
              ? "text-cream/40"
              : hearing
                ? "text-gold-bright"
                : "text-cream/50"
          )}
        >
          {label}
        </p>
      </div>

      <div
        className="flex h-12 items-end justify-between gap-[3px]"
        role="img"
        aria-label={label}
      >
        {bars.map((level, i) => {
          const h = muted ? 8 : Math.round(8 + level * 40);
          return (
            <span
              key={i}
              className={cn(
                "min-w-[3px] flex-1 rounded-sm transition-[height] duration-75",
                muted
                  ? "bg-cream/15"
                  : hearing
                    ? "bg-gold"
                    : "bg-gold/35"
              )}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}
