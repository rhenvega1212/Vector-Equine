"use client";

import { useEffect, useState } from "react";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";
import { FEEL_LABELS } from "@/lib/capture/vector-session";
import { useFeatureFlag } from "@/lib/flags/context";
import { formatInHomeTz } from "@/lib/timezone";

type Pending = {
  rideId: string;
  sessionDate: string;
  horse: string;
  trainerName: string | null;
  withTrainer: boolean;
  deferrals: number;
};

/**
 * Brief 14 named modal exception — blocking feel sheet.
 * No close, backdrop, Escape, swipe, or browser back.
 */
export function FeelRatingSheet() {
  const enabled = useFeatureFlag("vector_feel_prompt");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/train/feel/pending", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.pending) {
          setPending(data.pending as Pending);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Defeat browser back while blocking
  useEffect(() => {
    if (!pending) return;
    const push = () => {
      try {
        window.history.pushState({ feelBlock: true }, "");
      } catch {
        /* ignore */
      }
    };
    push();
    const onPop = (e: PopStateEvent) => {
      e.preventDefault?.();
      push();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pending]);

  // Defeat Escape
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending]);

  if (!enabled || !loaded || !pending) return null;

  const eyebrow = [
    "TODAY",
    pending.withTrainer && pending.trainerName
      ? `WITH ${pending.trainerName.toUpperCase()}`
      : null,
    pending.horse?.trim() ? pending.horse.trim().toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function answer(value: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/train/feel/${pending!.rideId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", value }),
      });
      if (res.ok) setPending(null);
    } finally {
      setBusy(false);
    }
  }

  async function defer() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/train/feel/${pending!.rideId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "defer" }),
      });
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] touch-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feel-rating-title"
      onClick={(e) => e.stopPropagation()}
    >
      <AtmosphereScreen className="flex h-full min-h-[100dvh] flex-col justify-center px-6 py-10">
        <p className="text-[10px] uppercase tracking-[0.28em] text-cream-dim">
          {eyebrow || formatInHomeTz(pending.sessionDate, "MMM d").toUpperCase()}
        </p>
        <h1
          id="feel-rating-title"
          className="mt-4 font-serif text-3xl text-cream"
        >
          How did it feel?
        </h1>
        <div className="mt-8 flex justify-between gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => void answer(n)}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(209,169,85,0.35)] font-serif text-2xl text-gold transition hover:border-gold hover:bg-gold/10 disabled:opacity-50"
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-4 flex justify-between text-[11px] text-cream-dim">
          <span>{FEEL_LABELS.low}</span>
          <span>{FEEL_LABELS.high}</span>
        </p>
        {pending.withTrainer ? (
          <p className="mt-8 text-sm text-cream/70">
            Your coach sees this for today&apos;s lesson.
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void defer()}
          className="mt-10 text-left text-sm text-cream-dim underline-offset-4 hover:text-cream hover:underline disabled:opacity-50"
        >
          Not now
        </button>
      </AtmosphereScreen>
    </div>
  );
}
