"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CaptureRoom } from "@/components/capture/capture-room";
import {
  MIC_BLOCKED_HELP,
  isMicGrantedStored,
  requestMicAccess,
} from "@/lib/capture/mic-preflight";
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
  const isTestLesson = searchParams.get("test") === "1";

  const [horseId, setHorseId] = useState<string | null>(horseIdParam);
  const [horseName, setHorseName] = useState("Horse");
  const [horsesReady, setHorsesReady] = useState(false);
  const [capture, setCapture] = useState<CaptureStart | null>(null);
  const [starting, setStarting] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [micHelp, setMicHelp] = useState<string | null>(null);
  const [micBusy, setMicBusy] = useState(false);

  useEffect(() => {
    setMicReady(isMicGrantedStored());
  }, []);

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
          body: JSON.stringify({
            horse_id: horseId || null,
            is_test: isTestLesson,
          }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horsesReady, horseId, isTestLesson]);

  const planHref = horseId
    ? `/train/ride/plan?horseId=${horseId}`
    : "/train/ride/plan";

  async function allowMic() {
    setMicBusy(true);
    const result = await requestMicAccess();
    setMicBusy(false);
    if (result.ok) {
      setMicReady(true);
      setMicHelp(null);
      return;
    }
    setMicHelp(result.message || MIC_BLOCKED_HELP);
  }

  async function endLesson(result?: {
    training_session_id?: string;
    ended_by?: string;
  }) {
    if (result?.training_session_id) {
      setEnding(true);
      router.push(`/train/sessions/${result.training_session_id}`);
      return;
    }
    // Fallback if CaptureRoom already ended remotely without an id yet
    if (!capture) return;
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`/api/capture/sessions/${capture.id}/status`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (data.training_session_id) {
        router.push(`/train/sessions/${data.training_session_id}`);
        return;
      }
    } catch {
      /* ignore */
    }
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
          {isTestLesson ? "Test lesson" : "Live lesson"}
        </span>
      </div>

      <p className="text-center text-xs text-cream/50">{horseName}</p>

      {!micReady && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            Microphone access
          </p>
          <p className="text-sm text-cream/85">
            Vector needs the mic for your headset call and conversation
            timeline. Tap Allow now — before you start the call — so Safari
            asks while you can still read these steps.
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-cream/70">
            <li>Tap Allow microphone below</li>
            <li>Choose Allow in the Safari prompt</li>
            <li>
              If you already denied it: Settings → Apps → Safari → Microphone
              → Allow, then return here
            </li>
          </ol>
          {micHelp && (
            <p className="text-sm text-destructive whitespace-pre-wrap">{micHelp}</p>
          )}
          <button
            type="button"
            disabled={micBusy}
            onClick={() => void allowMic()}
            className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-navy hover:bg-gold-bright disabled:opacity-50"
          >
            {micBusy ? "Asking Safari…" : "Allow microphone"}
          </button>
        </div>
      )}

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
          autoStart={micReady}
          onLessonClosed={({ remote, training_session_id }) => {
            if (!remote) return;
            if (training_session_id) {
              router.push(`/train/sessions/${training_session_id}`);
              return;
            }
            void (async () => {
              for (let i = 0; i < 6; i++) {
                try {
                  const res = await fetch(
                    `/api/capture/sessions/${capture.id}/status`,
                    { cache: "no-store" }
                  );
                  const data = await res.json();
                  if (data.training_session_id) {
                    router.push(`/train/sessions/${data.training_session_id}`);
                    return;
                  }
                } catch {
                  /* ignore */
                }
                await new Promise((r) => setTimeout(r, 800));
              }
            })();
          }}
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
