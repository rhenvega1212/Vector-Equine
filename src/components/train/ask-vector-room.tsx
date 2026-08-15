"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";
import type { AskExample } from "@/lib/ask/types";
import type { AskSource, AskTurn } from "@/lib/ask/types";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechWindow = Window & {
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  SpeechRecognition?: new () => SpeechRecognitionLike;
};

type RoomStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "answering"
  | "error";

function playBase64Mp3(
  b64: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onEnded: () => void
) {
  audioRef.current?.pause();
  const url = `data:audio/mpeg;base64,${b64}`;
  const audio = new Audio(url);
  audioRef.current = audio;
  audio.onended = onEnded;
  void audio.play().catch(() => onEnded());
}

export function AskVectorRoom({
  sessionId,
  backHref,
  contextLabel,
  examples,
  initialTurns,
}: {
  sessionId: string;
  backHref: string;
  contextLabel: string;
  examples: AskExample[];
  initialTurns: AskTurn[];
}) {
  const [mode, setMode] = useState<"voice" | "typed">("voice");
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [turns, setTurns] = useState<AskTurn[]>(initialTurns);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(
    initialTurns.length ? initialTurns[initialTurns.length - 1].id : null
  );
  const [speaking, setSpeaking] = useState(false);
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [liveHear, setLiveHear] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  const midRef = useRef<HTMLDivElement>(null);
  const holdStartRef = useRef<number | null>(null);
  const holdingRef = useRef(false);
  const holdArmedRef = useRef(false); // true from pointerdown until setup finishes or cancel
  const transcriptRef = useRef("");
  const interimRef = useRef("");
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
    abort?: () => void;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micDeniedRef = useRef(false);
  const sendAfterEndRef = useRef(false);
  const endFlushTimerRef = useRef<number | null>(null);

  const activeTurn =
    turns.find((t) => t.id === activeTurnId) ||
    turns[turns.length - 1] ||
    null;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (endFlushTimerRef.current != null) {
        window.clearTimeout(endFlushTimerRef.current);
      }
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
    };
  }, []);

  useEffect(() => {
    if (midRef.current) {
      midRef.current.scrollTop = midRef.current.scrollHeight;
    }
  }, [turns.length, status, pendingQuestion]);

  const ask = useCallback(
    async (question: string, askedByVoice: boolean) => {
      const q = question.trim();
      if (!q) {
        setNotice("Didn't catch that.");
        setStatus("idle");
        setPendingQuestion(null);
        return;
      }
      setNotice(null);
      setSourcesOpen(false);
      setPendingQuestion(q);
      setStatus("thinking");
      audioRef.current?.pause();
      setSpeaking(false);

      try {
        const res = await fetch(`/api/train/sessions/${sessionId}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, askedByVoice }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNotice(
            typeof data.error === "string"
              ? data.error
              : "Can't reach Vector right now."
          );
          setStatus("error");
          return;
        }
        const turn = data.turn as AskTurn;
        setTurns((prev) => [...prev, turn]);
        setActiveTurnId(turn.id);
        setPendingQuestion(null);
        setStatus("answering");

        // Speak in the background so the answer shows without waiting on TTS
        void (async () => {
          try {
            const speakRes = await fetch(
              `/api/train/sessions/${sessionId}/ask/speak`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ turnId: turn.id, text: turn.answer }),
              }
            );
            const speakData = await speakRes.json().catch(() => ({}));
            if (!speakData.audioBase64) return;
            setAudioCache((c) => ({ ...c, [turn.id]: speakData.audioBase64 }));
            setSpeaking(true);
            playBase64Mp3(speakData.audioBase64, audioRef, () =>
              setSpeaking(false)
            );
          } catch {
            /* text answer already shown */
          }
        })();
      } catch {
        setNotice("Can't reach Vector right now.");
        setStatus("error");
      }
    },
    [sessionId]
  );

  const flushHoldTranscript = useCallback(() => {
    if (endFlushTimerRef.current != null) {
      window.clearTimeout(endFlushTimerRef.current);
      endFlushTimerRef.current = null;
    }
    if (!sendAfterEndRef.current) return;
    sendAfterEndRef.current = false;
    const text = `${transcriptRef.current} ${interimRef.current}`.trim();
    transcriptRef.current = "";
    interimRef.current = "";
    setLiveHear("");
    if (!text) {
      setNotice("Didn't catch that.");
      setStatus("idle");
      return;
    }
    void ask(text, true);
  }, [ask]);

  const stopHold = useCallback(
    (cancelled: boolean) => {
      // Release during mic setup — cancel before recognition starts
      if (holdArmedRef.current && !holdingRef.current) {
        holdArmedRef.current = false;
        holdStartRef.current = null;
        setLiveHear("");
        setStatus("idle");
        return;
      }

      if (!holdingRef.current) return;
      holdingRef.current = false;
      holdArmedRef.current = false;
      const started = holdStartRef.current;
      holdStartRef.current = null;
      const elapsed = started != null ? Date.now() - started : 0;

      if (cancelled || elapsed < 300) {
        sendAfterEndRef.current = false;
        if (endFlushTimerRef.current != null) {
          window.clearTimeout(endFlushTimerRef.current);
          endFlushTimerRef.current = null;
        }
        try {
          recognitionRef.current?.abort?.();
          recognitionRef.current?.stop();
        } catch {
          /* ignore */
        }
        transcriptRef.current = "";
        interimRef.current = "";
        setLiveHear("");
        setStatus("idle");
        return;
      }

      // Leave listening UI immediately; wait for onend to flush finals + interim
      sendAfterEndRef.current = true;
      setLiveHear("");
      setStatus("idle");
      try {
        recognitionRef.current?.stop();
      } catch {
        flushHoldTranscript();
        return;
      }
      // Chrome sometimes never fires onend after stop — flush after a beat
      if (endFlushTimerRef.current != null) {
        window.clearTimeout(endFlushTimerRef.current);
      }
      endFlushTimerRef.current = window.setTimeout(() => {
        endFlushTimerRef.current = null;
        try {
          recognitionRef.current?.abort?.();
        } catch {
          /* ignore */
        }
        flushHoldTranscript();
      }, 600);
    },
    [flushHoldTranscript]
  );

  const startHold = useCallback(async () => {
    if (
      holdingRef.current ||
      holdArmedRef.current ||
      status === "thinking"
    ) {
      return;
    }
    setNotice(null);
    holdArmedRef.current = true;
    holdStartRef.current = Date.now();
    setStatus("listening");
    setLiveHear("");
    if (endFlushTimerRef.current != null) {
      window.clearTimeout(endFlushTimerRef.current);
      endFlushTimerRef.current = null;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      holdArmedRef.current = false;
      holdStartRef.current = null;
      setMode("typed");
      setNotice(
        "Microphone needs a secure page — open http://localhost:3000 (not a network IP)."
      );
      setStatus("idle");
      return;
    }

    if (micDeniedRef.current) {
      holdArmedRef.current = false;
      holdStartRef.current = null;
      setMode("typed");
      setNotice("Microphone is off. You can type instead.");
      setStatus("idle");
      return;
    }

    const w = window as SpeechWindow;
    const SpeechCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechCtor) {
      holdArmedRef.current = false;
      holdStartRef.current = null;
      setMode("typed");
      setNotice(
        "Hold-to-talk needs Chrome or Edge on this laptop. You can type instead."
      );
      setStatus("idle");
      return;
    }

    // Keep the mic stream open for the whole hold. Stopping it before STT
    // often leaves the bar "live" with no audio on desktop Chrome.
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      holdArmedRef.current = false;
      holdStartRef.current = null;
      const name = e instanceof DOMException ? e.name : "";
      micDeniedRef.current =
        name === "NotAllowedError" || name === "PermissionDeniedError";
      setMode("typed");
      setNotice(
        micDeniedRef.current
          ? "Microphone is blocked in the browser. Allow it for this site, or type instead."
          : "Couldn't reach the microphone. Check System Settings → Privacy → Microphone."
      );
      setStatus("idle");
      return;
    }

    const releaseMic = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    if (!holdArmedRef.current) {
      releaseMic();
      setStatus("idle");
      return;
    }

    transcriptRef.current = "";
    interimRef.current = "";
    sendAfterEndRef.current = false;
    holdingRef.current = true;

    const recognition = new SpeechCtor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finals += piece;
        else interim += piece;
      }
      transcriptRef.current = finals;
      interimRef.current = interim;
      setLiveHear(`${finals} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      const err = event.error || "";
      if (err === "not-allowed" || err === "service-not-allowed") {
        micDeniedRef.current = true;
        holdingRef.current = false;
        holdArmedRef.current = false;
        sendAfterEndRef.current = false;
        releaseMic();
        setMode("typed");
        setNotice(
          "Microphone is blocked. Allow it for this site, or type instead."
        );
        setStatus("idle");
        return;
      }
      if (err === "audio-capture") {
        holdingRef.current = false;
        holdArmedRef.current = false;
        sendAfterEndRef.current = false;
        releaseMic();
        setMode("typed");
        setNotice(
          "No microphone found. Check System Settings → Privacy → Microphone."
        );
        setStatus("idle");
        return;
      }
      if (err === "network") {
        holdingRef.current = false;
        holdArmedRef.current = false;
        sendAfterEndRef.current = false;
        releaseMic();
        setNotice("Speech service unreachable. Try again, or type instead.");
        setStatus("idle");
      }
    };

    recognition.onend = () => {
      releaseMic();
      holdingRef.current = false;
      holdArmedRef.current = false;
      if (!sendAfterEndRef.current) {
        if (endFlushTimerRef.current != null) {
          window.clearTimeout(endFlushTimerRef.current);
          endFlushTimerRef.current = null;
        }
        transcriptRef.current = "";
        interimRef.current = "";
        setLiveHear("");
        return;
      }
      flushHoldTranscript();
    };

    try {
      recognition.start();
    } catch {
      releaseMic();
      holdingRef.current = false;
      holdArmedRef.current = false;
      setStatus("idle");
      setNotice("Couldn't start listening. Try Chrome, or type instead.");
    }
  }, [status, ask, flushHoldTranscript]);

  useEffect(() => {
    function onUp() {
      if (holdingRef.current || holdArmedRef.current) stopHold(false);
    }
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [stopHold]);

  async function replay(turn: AskTurn) {
    audioRef.current?.pause();
    let b64 = audioCache[turn.id];
    if (!b64) {
      const res = await fetch(`/api/train/sessions/${sessionId}/ask/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId: turn.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.audioBase64) return;
      b64 = data.audioBase64;
      setAudioCache((c) => ({ ...c, [turn.id]: b64! }));
    }
    setActiveTurnId(turn.id);
    setSpeaking(true);
    playBase64Mp3(b64, audioRef, () => setSpeaking(false));
  }

  function sourceHref(src: AskSource): string {
    const ref = src.ref;
    if (ref.kind === "ride") return `/train/sessions/${ref.rideId}`;
    if (ref.kind === "transcript" || ref.kind === "moment") {
      return `${backHref}?t=${ref.atSec}#moment-${ref.atSec}`;
    }
    if (ref.kind === "measurement") {
      return `${backHref}#measurements`;
    }
    return backHref;
  }

  const showIdleInvite =
    turns.length === 0 &&
    status !== "thinking" &&
    status !== "listening" &&
    !pendingQuestion;

  return (
    <AtmosphereScreen className="fixed inset-0 z-40 min-h-dvh">
      {/* Context bar — under app header */}
      <div
        className="fixed left-0 right-0 z-50 border-b border-[var(--line)] bg-[rgba(14,23,41,0.9)] backdrop-blur-[10px]"
        style={{
          top: "calc(3.5rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex items-center justify-between gap-3.5 px-[26px] py-3.5 sm:top-16">
          <Link
            href={backHref}
            className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-gold hover:text-gold-bright"
          >
            ← Ride
          </Link>
          <Link
            href={backHref}
            className="min-w-0 truncate text-right text-[9.5px] uppercase tracking-[0.16em] text-cream-dim"
          >
            {contextLabel}
          </Link>
        </div>
      </div>

      {/* Room */}
      <div
        className="flex flex-col"
        style={{
          paddingTop:
            "calc(3.5rem + env(safe-area-inset-top, 0px) + 3.25rem)",
          paddingBottom: "calc(10.5rem + env(safe-area-inset-bottom, 0px))",
          minHeight: "100dvh",
        }}
      >
        <div
          ref={midRef}
          className={cn(
            "flex-1 overflow-y-auto px-[26px]",
            showIdleInvite && "flex flex-col justify-center"
          )}
        >
          {showIdleInvite ? (
            <div className="py-8">
              <p className="m-0 font-[Georgia,'Times_New_Roman',serif] text-[30px] font-normal leading-[1.28] text-cream">
                Ask me about the ride.
              </p>
              <div className="mt-[30px]">
                {examples.map((eg, i) => (
                  <div key={eg.text}>
                    {i > 0 ? (
                      <hr className="m-0 h-px border-0 bg-[var(--line)]" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void ask(eg.text, false)}
                      className="w-full py-3.5 text-left font-[Georgia,'Times_New_Roman',serif] text-base italic leading-snug text-cream-dim transition-colors hover:text-gold"
                    >
                      {eg.text}
                    </button>
                  </div>
                ))}
                {examples.length > 0 ? (
                  <hr className="m-0 h-px border-0 bg-[var(--line)]" />
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-10 py-8">
              {turns.map((turn) => (
                <div key={turn.id}>
                  <p className="text-[9.5px] uppercase tracking-[0.22em] text-cream-dim">
                    You asked
                  </p>
                  <p className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-[23px] leading-[1.36] text-cream">
                    {turn.question}
                  </p>
                  <p className="mt-7 text-[14.5px] leading-[1.8] text-cream/90">
                    {turn.answer}
                  </p>
                  <button
                    type="button"
                    onClick={() => void replay(turn)}
                    className="mt-6 flex items-center gap-2.5 text-[9.5px] uppercase tracking-[0.22em] text-gold hover:text-gold-bright"
                  >
                    {speaking && activeTurnId === turn.id ? (
                      <>
                        <span className="flex h-[13px] items-end gap-0.5" aria-hidden>
                          {[0, 1, 2, 3].map((i) => (
                            <i
                              key={i}
                              className="inline-block w-0.5 rounded-sm bg-gold"
                              style={{
                                animation: `ve-eq 1s ease-in-out ${i * 0.12}s infinite`,
                                height: 8,
                              }}
                            />
                          ))}
                        </span>
                        Speaking
                      </>
                    ) : (
                      <>◈ Play again</>
                    )}
                  </button>
                  {turn.sources.length > 0 ? (
                    <div className="mt-7">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTurnId(turn.id);
                          setSourcesOpen((v) =>
                            activeTurnId === turn.id ? !v : true
                          );
                        }}
                        className="text-[9.5px] uppercase tracking-[0.22em] text-gold hover:text-gold-bright"
                      >
                        Where this came from
                      </button>
                      {sourcesOpen && activeTurnId === turn.id ? (
                        <div className="mt-2">
                          <hr className="m-0 h-px border-0 bg-[var(--line)]" />
                          {turn.sources.map((s, i) => (
                            <div key={`${s.label}-${i}`}>
                              <Link
                                href={sourceHref(s)}
                                className="flex items-start gap-3.5 py-3.5 transition-opacity hover:opacity-70"
                              >
                                <span className="w-16 shrink-0 font-[Georgia,'Times_New_Roman',serif] text-[13px] text-gold">
                                  {s.label}
                                </span>
                                <span className="flex-1 text-xs leading-snug text-cream-dim">
                                  {s.text}
                                </span>
                              </Link>
                              <hr className="m-0 h-px border-0 bg-[var(--line)]" />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}

              {(status === "thinking" || status === "error") &&
              pendingQuestion ? (
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.22em] text-cream-dim">
                    You asked
                  </p>
                  <p className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-[23px] leading-[1.36] text-cream">
                    {pendingQuestion}
                  </p>
                  {status === "thinking" ? (
                    <div className="mt-7 flex items-center gap-3 text-[9.5px] uppercase tracking-[0.22em] text-cream-dim">
                      <span className="flex gap-1.5" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <i
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-gold"
                            style={{
                              animation: `ve-pulse-dot 1.3s ease-in-out ${i * 0.18}s infinite`,
                            }}
                          />
                        ))}
                      </span>
                      Listening back
                    </div>
                  ) : null}
                </div>
              ) : null}

              {notice ? (
                <p className="text-[13.5px] text-cream-dim">{notice}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div
        className="fixed left-0 right-0 z-50 px-[26px] pt-5"
        style={{
          bottom: 0,
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
          background:
            "linear-gradient(180deg, rgba(10,17,34,0) 0%, rgba(10,17,34,.94) 24%, rgba(10,17,34,1) 100%)",
        }}
      >
        {mode === "voice" ? (
          <div>
            <button
              type="button"
              className={cn(
                "flex h-[66px] w-full touch-none select-none items-center justify-center gap-3 rounded-sm border border-gold text-[10px] uppercase tracking-[0.26em] text-gold transition-colors",
                status === "listening" && "bg-gold text-[#101728]"
              )}
              onPointerDown={(e) => {
                e.preventDefault();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
                void startHold();
              }}
              onPointerUp={() => stopHold(false)}
              onPointerCancel={() => stopHold(true)}
            >
              {status === "listening" ? (
                <span className="flex h-6 items-end gap-[3px]" aria-hidden>
                  {Array.from({ length: 11 }).map((_, i) => (
                    <i
                      key={i}
                      className="inline-block w-0.5 rounded-sm bg-[#101728]"
                      style={{
                        animation: `ve-wave 0.85s ease-in-out ${i * 0.05}s infinite`,
                        height: 8,
                      }}
                    />
                  ))}
                </span>
              ) : (
                <>
                  <span aria-hidden>◈</span>
                  Hold to talk
                </>
              )}
            </button>
            {liveHear && status === "listening" ? (
              <p className="mt-3 text-center text-[13px] text-cream-dim">
                {liveHear}
              </p>
            ) : null}
            <div className="mt-[15px] text-center">
              <button
                type="button"
                onClick={() => setMode("typed")}
                className="text-[9px] uppercase tracking-[0.22em] text-cream-dim hover:text-gold"
              >
                Type instead
              </button>
            </div>
          </div>
        ) : (
          <div>
            <form
              className="flex gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                const q = typed.trim();
                if (!q) return;
                setTyped("");
                void ask(q, false);
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Ask about the ride…"
                className="h-[66px] flex-1 rounded-sm border border-[var(--line)] bg-transparent px-4 text-sm text-cream outline-none placeholder:text-cream-dim focus:border-gold"
                disabled={status === "thinking"}
              />
              <button
                type="submit"
                disabled={status === "thinking" || !typed.trim()}
                className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-sm border border-gold text-[15px] text-gold hover:bg-gold/10 disabled:opacity-40"
                aria-label="Send"
              >
                →
              </button>
            </form>
            <div className="mt-[15px] text-center">
              <button
                type="button"
                onClick={() => {
                  setMode("voice");
                  setNotice(null);
                }}
                className="text-[9px] uppercase tracking-[0.22em] text-cream-dim hover:text-gold"
              >
                ◈ Talk instead
              </button>
            </div>
          </div>
        )}
      </div>
    </AtmosphereScreen>
  );
}
