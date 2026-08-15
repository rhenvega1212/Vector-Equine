"use client";

import { useState } from "react";
import { FEEL_LABELS } from "@/lib/capture/vector-session";

/** Quiet ask on the ride page when feel is unanswered (after 48h or Not now). */
export function RideFeelAsk({
  rideId,
  withTrainer,
}: {
  rideId: string;
  withTrainer: boolean;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) return null;

  async function answer(value: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/train/feel/${rideId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", value }),
      });
      if (res.ok) setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[rgba(209,169,85,0.18)] pt-6">
      <p className="text-[10px] uppercase tracking-[0.28em] text-cream-dim">
        How did it feel?
      </p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onClick={() => void answer(n)}
            className="flex h-11 w-11 items-center justify-center border border-[rgba(209,169,85,0.35)] font-serif text-lg text-gold disabled:opacity-50"
          >
            {n}
          </button>
        ))}
      </div>
      <p className="flex justify-between text-[11px] text-cream-dim">
        <span>{FEEL_LABELS.low}</span>
        <span>{FEEL_LABELS.high}</span>
      </p>
      {withTrainer ? (
        <p className="text-sm text-cream/60">
          Your coach sees this for today&apos;s lesson.
        </p>
      ) : null}
    </div>
  );
}
