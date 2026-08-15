"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RideModeChooser,
  type RideMode,
} from "@/components/train/ride-mode-chooser";

type OpenCapture = {
  id: string;
  status: string;
  is_test?: boolean | null;
};

/**
 * Admin Lab — open Live in test mode (tagged is_test, hidden from product lists).
 * Always asks solo vs trainer. Ends a stuck open lesson first when needed.
 */
export function LabStartTestLesson({ horseId }: { horseId?: string | null }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [openCapture, setOpenCapture] = useState<OpenCapture | null>(null);
  const [endingOpen, setEndingOpen] = useState(false);
  const [help, setHelp] = useState<string | null>(null);

  const refreshOpen = useCallback(async () => {
    try {
      const res = await fetch("/api/capture/sessions", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.captures || []) as OpenCapture[];
      const open = list.find(
        (c) => c.status === "waiting" || c.status === "live"
      );
      setOpenCapture(open || null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshOpen();
  }, [refreshOpen]);

  async function endOpenLesson() {
    if (!openCapture) return;
    setEndingOpen(true);
    setHelp(null);
    try {
      const res = await fetch(`/api/capture/sessions/${openCapture.id}/end`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.capture_ended) {
        setHelp(
          typeof data.error === "string"
            ? data.error
            : "Could not end the open lesson"
        );
        return;
      }
      setOpenCapture(null);
      setChoosing(true);
    } catch {
      setHelp("Could not end the open lesson");
    } finally {
      setEndingOpen(false);
      void refreshOpen();
    }
  }

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
        coach lists, and averages. You&apos;ll choose solo or with a trainer
        before the room opens.
      </p>

      {openCapture ? (
        <div className="space-y-2 border-t border-gold/15 pt-3">
          <p className="text-sm text-cream/80">
            You still have an open lesson ({openCapture.status}
            {openCapture.is_test ? " · test" : ""}). End it before starting a
            fresh one — otherwise Start resumes the old room and skips the
            choice.
          </p>
          <button
            type="button"
            disabled={endingOpen}
            onClick={() => void endOpenLesson()}
            className="inline-flex min-h-[44px] items-center justify-center border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {endingOpen ? "Ending…" : "End open lesson"}
          </button>
        </div>
      ) : null}

      {help ? (
        <p className="text-xs text-watch">{help}</p>
      ) : null}

      {!choosing ? (
        <button
          type="button"
          disabled={Boolean(openCapture)}
          onClick={() => setChoosing(true)}
          className="inline-flex min-h-[44px] items-center justify-center border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10 disabled:opacity-40"
        >
          Start test lesson
        </button>
      ) : (
        <RideModeChooser onChoose={go} busy={navigating} />
      )}
    </div>
  );
}
