"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CaptureRoom } from "@/components/capture/capture-room";
import { ArrowLeft, Loader2 } from "lucide-react";

type CaptureStart = {
  id: string;
  join_code: string;
  join_url: string;
  t0: string;
  status: string;
  livekit: {
    configured: boolean;
    url: string | null;
    token: string | null;
  };
};

function CaptureLiveInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const horseIdParam = searchParams.get("horseId");

  const [horseId, setHorseId] = useState<string | null>(horseIdParam);
  const [horseName, setHorseName] = useState("Horse");
  const [horsesReady, setHorsesReady] = useState(false);
  const [capture, setCapture] = useState<CaptureStart | null>(null);
  const [starting, setStarting] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/train/horses");
        if (!res.ok) {
          if (!cancelled) setHorsesReady(true);
          return;
        }
        const data = await res.json();
        const horses = data?.horses || data || [];
        const match =
          (horseIdParam &&
            horses.find((h: { id: string }) => h.id === horseIdParam)) ||
          horses[0];
        if (!cancelled && match) {
          setHorseId(match.id);
          setHorseName(match.barn_name?.trim() || match.name || "Horse");
        }
      } catch {
        /* continue */
      } finally {
        if (!cancelled) setHorsesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [horseIdParam]);

  useEffect(() => {
    if (!horsesReady) return;
    let cancelled = false;
    (async () => {
      setStarting(true);
      setError(null);
      try {
        const res = await fetch("/api/capture/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horse_id: horseId || null }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Could not start capture");
          return;
        }
        if (!cancelled) setCapture(data);
      } catch {
        if (!cancelled) setError("Could not start capture");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Start once after horse roster resolves (horseId already set in that effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horsesReady]);

  const planHref = horseId
    ? `/train/ride/plan?horseId=${horseId}`
    : "/train/ride/plan";

  async function endLesson() {
    if (!capture) return;
    setEnding(true);
    setError(null);

    const maxAttempts = 3;
    let lastError = "Could not end lesson";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(`/api/capture/sessions/${capture.id}/end`, {
          method: "POST",
          keepalive: attempt === maxAttempts - 1,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.training_session_id) {
          router.push(`/train/sessions/${data.training_session_id}`);
          return;
        }
        lastError = data.error || "Could not end lesson";
        // Don't retry auth / hard client errors
        if (res.status === 401 || res.status === 404) break;
      } catch {
        lastError = "Could not end lesson — check barn Wi‑Fi and try again";
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
      }
    }

    setError(lastError);
    setEnding(false);
  }

  return (
    <div className="relative space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="text-cream/70">
          <Link href={planHref} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Plan
          </Link>
        </Button>
        <span className="text-[10px] uppercase tracking-[0.18em] text-cream/40">
          Live lesson
        </span>
      </div>

      <p className="text-center text-xs text-cream/50">{horseName}</p>

      {starting && (
        <div className="flex items-center justify-center gap-2 py-12 text-cream/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          Starting capture…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {capture && !starting && (
        <CaptureRoom
          captureSessionId={capture.id}
          t0={capture.t0}
          speaker="rider"
          displayName="You"
          livekit={capture.livekit}
          joinCode={capture.join_code}
          joinUrl={capture.join_url}
          peerLabel="trainer"
          onEnd={endLesson}
          ending={ending}
        />
      )}
    </div>
  );
}

export default function LiveRidePage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-cream/50">Starting capture lesson…</div>
      }
    >
      <CaptureLiveInner />
    </Suspense>
  );
}
