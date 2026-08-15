"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type PendingCoach = {
  id: string;
  trainerName: string;
  lessonHint: string | null;
};

/**
 * Rider approval for capture-initiated coach connections.
 * Taught lesson stays readable either way; this gates other rides.
 */
export function CoachShareApproval({ pending }: { pending: PendingCoach[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState(pending);

  if (items.length === 0) return null;

  async function choose(
    id: string,
    action: "all" | "shared_only" | "no"
  ) {
    setBusyId(id);
    try {
      if (action === "no") {
        const res = await fetch("/api/connections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "declined" }),
        });
        if (!res.ok) return;
      } else {
        const res = await fetch("/api/connections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            status: "active",
            share_scope: action,
          }),
        });
        if (!res.ok) return;
      }
      setItems((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 px-7 pb-2">
      {items.map((p) => (
        <div
          key={p.id}
          className="border-t border-gold/20 pt-5"
        >
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
            Coach request
          </p>
          <p className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-xl text-cream">
            {p.trainerName} coached your lesson
            {p.lessonHint ? ` ${p.lessonHint}` : ""}.
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-cream/55">
            Let them see your other rides? They already have the lesson they taught.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-gold font-semibold text-navy hover:bg-gold-bright"
              disabled={busyId === p.id}
              onClick={() => choose(p.id, "all")}
            >
              All rides
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-gold/35 text-cream hover:bg-gold/10"
              disabled={busyId === p.id}
              onClick={() => choose(p.id, "shared_only")}
            >
              Only what I share
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-cream/50 hover:text-cream"
              disabled={busyId === p.id}
              onClick={() => choose(p.id, "no")}
            >
              No
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
