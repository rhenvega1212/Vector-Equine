"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RideMode } from "@/components/train/ride-mode-chooser";

type OpenCapture = {
  id: string;
  status: string;
  join_code?: string | null;
  is_test?: boolean | null;
};

/**
 * Admin Lab — open Live in test mode (tagged is_test, hidden from product lists).
 * Solo-first. Leftover waiting/live rows are abandoned shells — Start clears them.
 */
export function LabStartTestLesson({ horseId }: { horseId?: string | null }) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [openCapture, setOpenCapture] = useState<OpenCapture | null>(null);
  const [clearing, setClearing] = useState(false);
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

  async function clearOpenLesson(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/capture/sessions/${id}/end`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.capture_ended) {
        setHelp(
          typeof data.error === "string"
            ? data.error
            : "Could not clear the leftover lesson"
        );
        return false;
      }
      setOpenCapture(null);
      return true;
    } catch {
      setHelp("Could not clear the leftover lesson");
      return false;
    }
  }

  async function clearLeftoverOnly() {
    if (!openCapture) return;
    setClearing(true);
    setHelp(null);
    await clearOpenLesson(openCapture.id);
    setClearing(false);
    void refreshOpen();
    // Lab list is a server component — refresh so WAITING drops from the list
    router.refresh();
  }

  async function go(mode: RideMode) {
    setNavigating(true);
    setHelp(null);
    if (openCapture) {
      const ok = await clearOpenLesson(openCapture.id);
      if (!ok) {
        setNavigating(false);
        return;
      }
    }
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
        coach lists, and averages. Solo starts on this phone’s mic — no headset
        wait.
      </p>

      {openCapture ? (
        <div className="space-y-2 border-t border-gold/15 pt-3">
          <p className="text-sm text-cream/80">
            Leftover capture still marked open
            {openCapture.join_code ? ` · ${openCapture.join_code}` : ""} (
            {openCapture.status}). You’re not on a live ride — Start clears it
            and opens a fresh test.
          </p>
          <button
            type="button"
            disabled={clearing || navigating}
            onClick={() => void clearLeftoverOnly()}
            className="inline-flex min-h-[44px] items-center justify-center border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear leftover"}
          </button>
        </div>
      ) : null}

      {help ? (
        <p className="text-xs text-watch">{help}</p>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          disabled={navigating || clearing}
          onClick={() => void go("solo")}
          className="inline-flex min-h-[48px] items-center justify-center bg-gold px-4 py-2.5 text-sm font-semibold text-navy hover:bg-gold-bright disabled:opacity-40"
        >
          {navigating
            ? "Opening…"
            : openCapture
              ? "Clear & start solo test"
              : "Start solo test"}
        </button>
        <button
          type="button"
          disabled={navigating || clearing}
          onClick={() => void go("with_trainer")}
          className="inline-flex min-h-[44px] items-center justify-center border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10 disabled:opacity-40"
        >
          {openCapture ? "Clear & start with a trainer" : "Start with a trainer"}
        </button>
      </div>
    </div>
  );
}
