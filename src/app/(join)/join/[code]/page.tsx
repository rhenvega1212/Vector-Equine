"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CaptureRoom } from "@/components/capture/capture-room";
import { Loader2 } from "lucide-react";

type Preview = {
  join_code: string;
  status: string;
  rider_name: string;
  horse_name: string | null;
  livekit_configured: boolean;
};

type Joined = {
  capture_session_id: string;
  t0: string;
  rider_name: string;
  horse_name: string | null;
  trainer_display_name: string;
  guest_token: string;
  livekit: {
    configured: boolean;
    url: string | null;
    token: string | null;
  };
};

function storageKey(code: string) {
  return `vector-capture-join:${code}`;
}

export default function GuestJoinPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resume trainer session after lock / Safari reload
        try {
          const raw = sessionStorage.getItem(storageKey(code));
          if (raw) {
            const saved = JSON.parse(raw) as Joined;
            if (saved?.capture_session_id && saved?.guest_token) {
              if (!cancelled) {
                setJoined(saved);
                setLoading(false);
                return;
              }
            }
          }
        } catch {
          /* ignore */
        }

        const res = await fetch(`/api/capture/join/${code}`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Could not load lesson");
          return;
        }
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setError("Could not load lesson");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function join() {
    if (!name.trim()) {
      setError("Enter your name");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (
          /not allowed|Permission/i.test(msg) ||
          (e instanceof DOMException && e.name === "NotAllowedError")
        ) {
          setError(
            "Microphone blocked. On iPhone: Settings → Apps → Safari → Microphone → Allow, then reload and try again."
          );
          return;
        }
      }

      const res = await fetch(`/api/capture/join/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not join");
        return;
      }
      try {
        sessionStorage.setItem(storageKey(code), JSON.stringify(data));
      } catch {
        /* ignore */
      }
      setJoined(data);
    } catch {
      setError("Could not join");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error && !preview && !joined) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-serif text-2xl text-cream">Lesson unavailable</p>
        <p className="text-sm text-cream/55">{error}</p>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Vector
          </p>
          <h1 className="font-serif text-2xl text-cream">
            Connected to {joined.rider_name}&apos;s lesson
            {joined.horse_name ? ` — ${joined.horse_name}` : ""}
          </h1>
          <p className="text-sm text-cream/50">
            Two-way audio. Lesson stays open if the phone sleeps — call
            reconnects automatically.
          </p>
        </header>
        <CaptureRoom
          captureSessionId={joined.capture_session_id}
          t0={joined.t0}
          speaker="trainer"
          displayName={joined.trainer_display_name}
          livekit={joined.livekit}
          guestToken={joined.guest_token}
          peerLabel={joined.rider_name}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
          Vector
        </p>
        <h1 className="font-serif text-3xl text-cream">Join lesson</h1>
        <p className="text-sm text-cream/55">
          {preview
            ? `Connected to ${preview.rider_name}'s lesson${
                preview.horse_name ? ` — ${preview.horse_name}` : ""
              }. No account needed.`
            : "Enter your name to join."}
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-cream/70">Your name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Coach name"
          className="bg-[#131C31] border-gold/20 text-cream"
        />
      </div>

      <Button
        onClick={join}
        disabled={joining}
        className="w-full bg-gold text-navy font-semibold hover:bg-gold-bright"
      >
        {joining ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Joining…
          </>
        ) : (
          "Join with microphone"
        )}
      </Button>
    </div>
  );
}
