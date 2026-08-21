"use client";

import { useEffect, useState } from "react";
import { FEEL_LABELS } from "@/lib/capture/vector-session";

/** Debrief feel ask — tied to this ride, not a floating sheet. */
export function RideFeelAsk({
  rideId,
  withTrainer,
  horseName,
  title,
  whenLabel,
  joinCode,
}: {
  rideId: string;
  withTrainer: boolean;
  horseName: string;
  title: string;
  whenLabel: string;
  joinCode?: string | null;
}) {
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#feel") return;
    document
      .getElementById("feel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (dismissed) return null;

  if (done) {
    return (
      <div className="border-b border-[rgba(209,169,85,0.18)] px-[26px] py-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
          How it felt
        </p>
        <p className="mt-2 font-serif text-2xl text-cream">
          {picked} · saved for this ride
        </p>
      </div>
    );
  }

  async function answer(value: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/train/feel/${rideId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", value }),
      });
      if (res.ok) {
        setPicked(value);
        setDone(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function defer() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/train/feel/${rideId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "defer" }),
      });
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  const idBits = [
    horseName?.trim() || null,
    title?.trim() || null,
    whenLabel?.trim() || null,
    joinCode ? `Code ${joinCode}` : null,
  ].filter(Boolean);

  return (
    <div
      id="feel"
      className="mt-8 border-y border-[rgba(209,169,85,0.28)] bg-[rgba(209,169,85,0.06)] px-[26px] py-7"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
        This ride
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-cream/70">
        {idBits.join(" · ")}
      </p>
      <h2 className="mt-5 font-serif text-[26px] leading-tight text-cream">
        How did it feel?
      </h2>
      <div className="mt-6 flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onClick={() => void answer(n)}
            className="flex h-12 w-12 items-center justify-center border border-[rgba(209,169,85,0.35)] font-serif text-xl text-gold hover:border-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-3 flex justify-between text-[11px] text-cream-dim">
        <span>{FEEL_LABELS.low}</span>
        <span>{FEEL_LABELS.high}</span>
      </p>
      {withTrainer ? (
        <p className="mt-4 text-sm text-cream/60">
          Your coach sees this for this lesson.
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void defer()}
        className="mt-6 min-h-[44px] text-sm text-cream-dim underline-offset-4 hover:text-cream hover:underline disabled:opacity-50"
      >
        Not now
      </button>
    </div>
  );
}
