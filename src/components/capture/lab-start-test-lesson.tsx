"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RideModeChooser,
  type RideMode,
} from "@/components/train/ride-mode-chooser";

/**
 * Admin Lab — open Live in test mode (tagged is_test, hidden from product lists).
 * Same solo / with-trainer step as the home Start dial.
 */
export function LabStartTestLesson({ horseId }: { horseId?: string | null }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [navigating, setNavigating] = useState(false);

  function go(mode: RideMode) {
    setNavigating(true);
    const q = new URLSearchParams({ test: "1", mode });
    if (horseId) q.set("horseId", horseId);
    router.push(`/train/ride/live?${q.toString()}`);
  }

  return (
    <div className="space-y-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-gold">
        Test lesson
      </p>
      <p className="text-sm text-cream/75">
        Same Live room, bookends, and feel sheet — tagged{" "}
        <span className="text-gold">is_test</span> so it stays out of Last rides,
        coach lists, and averages. Pick solo to exercise Hey Vector alone, or
        with a trainer to open the join code on a second phone.
      </p>
      {!choosing ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="inline-flex min-h-[44px] items-center justify-center border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"
        >
          Start test lesson
        </button>
      ) : (
        <RideModeChooser onChoose={go} busy={navigating} />
      )}
    </div>
  );
}
