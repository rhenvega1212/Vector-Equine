"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isBriefPending } from "@/lib/capture/transcript-cleanup";

/** Poll until Claude polish lands, then refresh the ride page. */
export function BriefPendingRefresh({
  sessionId,
  pending,
}: {
  sessionId: string;
  pending: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/train/sessions/${sessionId}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const summary = typeof data.summary === "string" ? data.summary : "";
        if (!isBriefPending(summary)) {
          router.refresh();
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled && tries < 30) {
        window.setTimeout(() => void tick(), 2500);
      }
    };
    const id = window.setTimeout(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [pending, sessionId, router]);

  if (!pending) return null;

  return (
    <p className="mt-6 text-[12.5px] text-cream-dim">
      Writing your brief… this usually takes a few seconds.
    </p>
  );
}
