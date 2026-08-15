"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function pad(n: number) {
  return (n < 10 ? "0" : "") + n;
}

function fmt(seconds: number) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

/**
 * Gold start dial — press inverts to a live timer with a sweeping arc.
 * Interval is cleared on unmount. Navigation is left to `onStart`.
 */
export function StartDial({
  horseName,
  onStart,
  className,
}: {
  horseName: string;
  onStart?: () => void | Promise<void>;
  className?: string;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handlePress() {
    if (running) return;
    setRunning(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    await onStart?.();
  }

  return (
    <div
      className={cn(
        "relative mx-auto mt-[38px] h-[178px] w-[178px]",
        running && "ve-dial-running",
        className
      )}
      data-dial
    >
      <svg
        className="pointer-events-none absolute inset-0 -rotate-90"
        viewBox="0 0 178 178"
        aria-hidden
      >
        <circle
          cx="89"
          cy="89"
          r="85"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1"
          strokeDasharray="534"
          strokeDashoffset="534"
          className={cn(
            "opacity-0 transition-opacity duration-300 ease-out",
            running && "opacity-90 [animation:ve-dial-sweep_60s_linear_infinite]"
          )}
        />
      </svg>
      <button
        type="button"
        onClick={() => void handlePress()}
        className={cn(
          "absolute inset-0 flex h-[178px] w-[178px] flex-col items-center justify-center gap-1.5 rounded-full border border-gold bg-gold text-[#101728] transition-[background-color,color,transform] duration-[220ms] ease-out",
          "hover:bg-gold-bright",
          "active:scale-[0.97]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright",
          "shadow-none",
          running &&
            "border-[rgba(209,169,85,0.35)] bg-transparent text-gold-bright hover:bg-transparent"
        )}
        aria-pressed={running}
        aria-label={running ? `Riding ${horseName}` : "Start ride"}
      >
        <span
          className={cn(
            "font-[Georgia,'Times_New_Roman',serif] text-2xl uppercase tracking-[0.16em]",
            running && "text-[30px] normal-case tracking-[0.06em]"
          )}
        >
          {running ? fmt(elapsed) : "Start"}
        </span>
        <span
          className={cn(
            "text-[9px] uppercase tracking-[0.3em] opacity-70",
            running && "text-cream-dim opacity-100"
          )}
        >
          {running ? `Riding · ${horseName}` : "Tap to ride"}
        </span>
      </button>
    </div>
  );
}
