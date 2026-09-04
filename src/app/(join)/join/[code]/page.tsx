"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CaptureRoom } from "@/components/capture/capture-room";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

type Preview = {
  join_code: string;
  status: string;
  rider_name: string;
  horse_name: string | null;
  livekit_configured: boolean;
  viewer_is_rider?: boolean;
  is_test?: boolean;
};

type Joined = {
  capture_session_id: string;
  t0: string;
  rider_name: string;
  horse_name: string | null;
  trainer_display_name: string;
  guest_token: string;
  claim_token?: string | null;
  is_test?: boolean;
  livekit: {
    configured: boolean;
    url: string | null;
    token: string | null;
  };
};

type ClaimTeaser = {
  valid: boolean;
  pending: boolean;
  rider_name: string;
  horse_name: string | null;
  focus: string | null;
  correction_count: number | null;
  duration_minutes: number | null;
};

function storageKey(code: string) {
  return `vector-capture-join:${code}`;
}

function claimStorageKey(code: string) {
  return `vector-capture-claim:${code}`;
}

export default function GuestJoinPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [name, setName] = useState("");
  const [authCoach, setAuthCoach] = useState<{
    displayName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [claimTeaser, setClaimTeaser] = useState<ClaimTeaser | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const kill = window.setTimeout(() => ac.abort(), 10000);

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
                if (saved.claim_token) setClaimToken(saved.claim_token);
                setLoading(false);
                return;
              }
            }
          }
          const savedClaim = sessionStorage.getItem(claimStorageKey(code));
          if (savedClaim && !cancelled) setClaimToken(savedClaim);
        } catch {
          /* ignore */
        }

        const res = await fetch(`/api/capture/join/${code}`, { signal: ac.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Could not load lesson");
          return;
        }
        if (cancelled) return;
        setPreview(data);
        setLoading(false);

        // Rider on a second phone: unlock name — join as coach persona, not as yourself.
        if (data.viewer_is_rider) {
          setAuthCoach(null);
          setName("");
          return;
        }

        // Auth is optional. Camera-opened Safari can hang forever on getUser()
        // if we await it before painting the join screen.
        try {
          const supabase = createClient();
          const raced = await Promise.race([
            supabase.auth.getUser(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);
          if (!raced || cancelled) return;
          const user = raced.data?.user;
          if (!user) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, role_trainer")
            .eq("id", user.id)
            .maybeSingle();
          if (cancelled) return;
          if (profile?.display_name) {
            setAuthCoach({ displayName: profile.display_name });
            setName(profile.display_name);
          } else {
            setAuthCoach({ displayName: "" });
          }
        } catch {
          /* guest */
        }
      } catch {
        if (!cancelled) setError("Could not load lesson");
      } finally {
        window.clearTimeout(kill);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(kill);
    };
  }, [code]);

  async function join() {
    const ownLesson = Boolean(preview?.viewer_is_rider);
    const displayName = ownLesson
      ? name.trim()
      : authCoach?.displayName?.trim() || name.trim();
    if (!displayName) {
      setError(
        ownLesson ? "Enter the coach name for this phone" : "Enter your name"
      );
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
            "Microphone blocked. On iPhone: Settings → Apps → Safari → Microphone → Allow, then come back and tap Join with microphone again. This message stays until you succeed."
          );
          return;
        }
      }

      const res = await fetch(`/api/capture/join/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not join");
        return;
      }
      try {
        sessionStorage.setItem(storageKey(code), JSON.stringify(data));
        if (data.claim_token) {
          sessionStorage.setItem(claimStorageKey(code), data.claim_token);
        }
      } catch {
        /* ignore */
      }
      if (data.claim_token) setClaimToken(data.claim_token);
      try {
        const { unlockVectorAudio } = await import(
          "@/lib/capture/play-vector-audio"
        );
        await unlockVectorAudio();
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

  async function openClaimTeaser(token: string) {
    setShowClaim(true);
    setClaimLoading(true);
    try {
      const res = await fetch(`/api/capture/claim/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok) {
        setClaimTeaser({
          valid: !!data.valid,
          pending: !!data.pending,
          rider_name: data.rider_name || joined?.rider_name || "Rider",
          horse_name: data.horse_name ?? joined?.horse_name ?? null,
          focus: data.focus ?? null,
          correction_count:
            typeof data.correction_count === "number"
              ? data.correction_count
              : null,
          duration_minutes:
            typeof data.duration_minutes === "number"
              ? data.duration_minutes
              : null,
        });
      } else {
        setClaimTeaser({
          valid: false,
          pending: true,
          rider_name: joined?.rider_name || "Rider",
          horse_name: joined?.horse_name ?? null,
          focus: null,
          correction_count: null,
          duration_minutes: null,
        });
      }
    } catch {
      setClaimTeaser({
        valid: true,
        pending: true,
        rider_name: joined?.rider_name || "Rider",
        horse_name: joined?.horse_name ?? null,
        focus: null,
        correction_count: null,
        duration_minutes: null,
      });
    } finally {
      setClaimLoading(false);
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

  if (showClaim && claimToken) {
    const rider = claimTeaser?.rider_name || joined?.rider_name || "Rider";
    const pending = claimTeaser?.pending !== false;
    const corrections = claimTeaser?.correction_count;
    const focus = claimTeaser?.focus;
    const signupHref = `/signup?claim=${encodeURIComponent(claimToken)}${
      joined?.trainer_display_name
        ? `&name=${encodeURIComponent(joined.trainer_display_name)}`
        : ""
    }`;

    let italicLine: string;
    if (pending || claimLoading) {
      italicLine = "Your write-up is on the way — save this lesson so you can open it.";
    } else if (corrections != null && corrections > 0 && focus) {
      italicLine = `${corrections} correction${corrections === 1 ? "" : "s"}, the work, and the homework you set.`;
    } else if (corrections != null && corrections > 0) {
      italicLine = `${corrections} correction${corrections === 1 ? "" : "s"} captured — open the write-up.`;
    } else if (focus) {
      italicLine = focus;
    } else {
      italicLine = "The work, what was said, and the homework you set.";
    }

    return (
      <AtmosphereScreen className="-mx-4 -my-6 flex min-h-[100dvh] flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-md space-y-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            Vector
          </p>
          <h1 className="font-serif text-3xl leading-tight text-cream sm:text-4xl">
            {pending
              ? `${rider}'s lesson is being written up.`
              : `${rider}'s lesson is written up.`}
          </h1>
          <p className="font-serif text-lg italic text-gold/90">{italicLine}</p>
          <div className="space-y-3 pt-2">
            <Button
              asChild
              className="w-full bg-gold text-navy font-semibold hover:bg-gold-bright"
            >
              <Link href={signupHref}>
                Create a free coach account to open it
              </Link>
            </Button>
            <button
              type="button"
              className="w-full text-sm text-cream/45 underline-offset-4 hover:text-cream/70 hover:underline"
              onClick={() => {
                setShowClaim(false);
                setJoined(null);
                try {
                  sessionStorage.removeItem(storageKey(code));
                } catch {
                  /* ignore */
                }
              }}
            >
              Not now
            </button>
          </div>
          <p className="text-xs text-cream/35">
            This link stays good for 7 days.
          </p>
        </div>
      </AtmosphereScreen>
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
            Two-way audio. Either of you can End lesson — it closes for both
            phones.
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
          autoStart
          isTestLesson={Boolean(joined.is_test || preview?.is_test)}
          riderFirstName={joined.rider_name?.split(/\s+/)[0] || null}
          trainerFirstName={
            joined.trainer_display_name?.split(/\s+/)[0] || null
          }
          onLessonClosed={() => {
            try {
              sessionStorage.removeItem(storageKey(code));
            } catch {
              /* ignore */
            }
            const token = claimToken || joined.claim_token;
            if (token) {
              void openClaimTeaser(token);
            } else {
              setJoined(null);
            }
          }}
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
          {preview?.viewer_is_rider
            ? `This is your lesson${
                preview.horse_name ? ` — ${preview.horse_name}` : ""
              }. Enter the coach name for this phone — no second account needed.`
            : preview
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

      {(preview?.viewer_is_rider || !authCoach?.displayName) && (
        <div className="space-y-2">
          <Label className="text-cream/70">
            {preview?.viewer_is_rider ? "Coach name on this phone" : "Your name"}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={preview?.viewer_is_rider ? "e.g. Emma" : "Coach name"}
            autoComplete="name"
            className="bg-[#131C31] border-gold/20 text-cream"
          />
        </div>
      )}

      {!preview?.viewer_is_rider && authCoach?.displayName && (
        <p className="text-sm text-cream/60">
          Joining as <span className="text-cream">{authCoach.displayName}</span>
        </p>
      )}

      <div className="space-y-2">
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
        <p className="text-center text-xs text-cream/40">
          Coaching here often? You can save this after the lesson.
        </p>
      </div>
    </div>
  );
}
