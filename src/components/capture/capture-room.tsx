"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type RemoteTrack,
} from "livekit-client";
import { formatOffset } from "@/lib/capture/summary";
import { createKeepAwake, type KeepAwakeHandle } from "@/lib/capture/keep-awake";

type LivekitCreds = {
  configured: boolean;
  url: string | null;
  token: string | null;
};

type Segment = {
  id?: string;
  offset_ms: number;
  speaker: "rider" | "trainer" | "system";
  text: string;
};

type MediaDeviceRow = { deviceId: string; label: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
  }>;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const CALL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  if (
    name === "NotAllowedError" ||
    /not allowed by the user agent|permission/i.test(msg)
  ) {
    return "Microphone blocked. On iPhone: Settings → Apps → Safari → Microphone → Allow, then reload this page and tap Start again.";
  }
  if (name === "NotFoundError") {
    return "No microphone found. Plug in headphones with a mic and try again.";
  }
  return msg || "Could not start call";
}

function unlockSafariScroll() {
  try {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "";
    body.style.overflow = "";
    const y = window.scrollY || 0;
    window.scrollTo(0, y + 1);
    window.scrollTo(0, y);
  } catch {
    /* ignore */
  }
}

async function acquireMicStream(
  preferredDeviceId?: string
): Promise<MediaStream> {
  const withDevice: MediaTrackConstraints = {
    ...CALL_AUDIO_CONSTRAINTS,
    ...(preferredDeviceId ? { deviceId: { ideal: preferredDeviceId } } : {}),
  };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: withDevice,
      video: false,
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  }
}

export function CaptureRoom({
  captureSessionId,
  t0,
  speaker,
  displayName,
  livekit: livekitProp,
  guestToken,
  joinCode,
  joinUrl,
  peerLabel,
  onEnd,
  ending,
}: {
  captureSessionId: string;
  t0: string;
  speaker: "rider" | "trainer";
  displayName: string;
  livekit: LivekitCreds;
  guestToken?: string | null;
  joinCode?: string;
  joinUrl?: string;
  peerLabel: string;
  onEnd?: () => void;
  ending?: boolean;
}) {
  const [roomState, setRoomState] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "error"
  >("idle");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [mics, setMics] = useState<MediaDeviceRow[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceRow[]>([]);
  const [micId, setMicId] = useState<string>("");
  const [speakerId, setSpeakerId] = useState<string>("");
  const [screenHint, setScreenHint] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localMicRef = useRef<LocalAudioTrack | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
  const keepAwakeRef = useRef<KeepAwakeHandle | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const intentionalEndRef = useRef(false);
  const callDesiredRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectingRef = useRef(false);
  const connectCallRef = useRef<(opts?: { reconnect?: boolean }) => Promise<void>>(
    async () => undefined
  );
  const livekitRef = useRef(livekitProp);
  const micIdRef = useRef(micId);
  const speakerIdRef = useRef(speakerId);
  const t0Ms = useRef(new Date(t0).getTime());

  livekitRef.current = livekitProp;
  micIdRef.current = micId;
  speakerIdRef.current = speakerId;

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, Date.now() - t0Ms.current));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const micList = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }));
      const speakerList = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${i + 1}`,
        }));
      setMics(micList);
      setSpeakers(speakerList);
      setMicId((prev) => prev || micList[0]?.deviceId || "");
      setSpeakerId((prev) => prev || speakerList[0]?.deviceId || "");
    } catch {
      /* ignore */
    }
  }, []);

  const attachRemoteAudio = useCallback(async (track: RemoteTrack) => {
    const el = audioElRef.current;
    if (!el || track.kind !== Track.Kind.Audio) return;
    track.attach(el);
    el.muted = false;
    try {
      await el.play();
    } catch {
      /* gesture already used on Start */
    }
  }, []);

  const applySpeakerOutput = useCallback(async (deviceId: string) => {
    const el = audioElRef.current as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    } | null;
    if (!el || !deviceId || typeof el.setSinkId !== "function") return;
    try {
      await el.setSinkId(deviceId);
    } catch {
      /* ignore */
    }
  }, []);

  const playKeepAliveAudio = useCallback(async () => {
    const el = keepAliveAudioRef.current;
    if (!el) return;
    el.loop = true;
    el.volume = 0.01;
    try {
      await el.play();
    } catch {
      /* ignore */
    }
  }, []);

  const startKeepAwake = useCallback(async () => {
    if (!keepAwakeRef.current) {
      keepAwakeRef.current = createKeepAwake();
    }
    await keepAwakeRef.current.start();
    setScreenHint(false);
  }, []);

  const stopKeepAwake = useCallback(() => {
    keepAwakeRef.current?.stop();
    keepAwakeRef.current = null;
  }, []);

  const fetchFreshLivekit = useCallback(async (): Promise<LivekitCreds | null> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (guestToken) headers.Authorization = `Bearer ${guestToken}`;
    const res = await fetch(
      `/api/capture/sessions/${captureSessionId}/reconnect`,
      { method: "POST", headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.livekit as LivekitCreds;
  }, [captureSessionId, guestToken]);

  const teardownRoom = useCallback(() => {
    localMicRef.current?.stop();
    localMicRef.current = null;
    try {
      roomRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    roomRef.current = null;
  }, []);

  const connectCall = useCallback(
    async (opts?: { reconnect?: boolean }) => {
      if (intentionalEndRef.current) return;
      if (connectingRef.current) return;
      if (roomRef.current && roomRef.current.state === "connected") return;

      connectingRef.current = true;
      callDesiredRef.current = true;
      setRoomState(opts?.reconnect ? "reconnecting" : "connecting");
      setRoomError(null);

      try {
        let creds = livekitRef.current;
        if (opts?.reconnect || !creds.token || !creds.url) {
          const fresh = await fetchFreshLivekit();
          if (fresh?.token && fresh.url) {
            creds = fresh;
            livekitRef.current = fresh;
          }
        }
        if (!creds.configured || !creds.url || !creds.token) {
          throw new Error(
            "LiveKit is not configured. Add LIVEKIT_* env vars and redeploy."
          );
        }

        // Mic unlock — may fail silently on pure reconnect while backgrounded
        try {
          const preview = await acquireMicStream(micIdRef.current || undefined);
          preview.getTracks().forEach((t) => t.stop());
          await refreshDevices();
        } catch {
          /* reconnect may resume without re-prompt */
        }

        await playKeepAliveAudio();
        await startKeepAwake();

        teardownRoom();

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          webAudioMix: false,
          disconnectOnPageLeave: false,
          audioCaptureDefaults: { ...CALL_AUDIO_CONSTRAINTS },
        });
        roomRef.current = room;

        const syncPeers = () => {
          setPeerConnected(room.remoteParticipants.size > 0);
        };

        room.on(RoomEvent.TrackSubscribed, (track) => {
          void attachRemoteAudio(track as RemoteTrack);
        });
        room.on(RoomEvent.ParticipantConnected, syncPeers);
        room.on(RoomEvent.ParticipantDisconnected, syncPeers);
        room.on(RoomEvent.Reconnecting, () => {
          if (!intentionalEndRef.current) setRoomState("reconnecting");
        });
        room.on(RoomEvent.Reconnected, () => {
          setRoomState("connected");
          reconnectAttemptRef.current = 0;
          void playKeepAliveAudio();
          void startKeepAwake();
        });
        room.on(RoomEvent.Disconnected, () => {
          setPeerConnected(false);
          roomRef.current = null;
          localMicRef.current?.stop();
          localMicRef.current = null;
          if (intentionalEndRef.current) {
            setRoomState("idle");
            callDesiredRef.current = false;
            stopKeepAwake();
            return;
          }
          // Lesson stays open — silently bring the call back
          setRoomState("reconnecting");
          scheduleReconnect();
        });

        await room.startAudio();
        await room.connect(creds.url, creds.token, {
          autoSubscribe: true,
        });
        await room.startAudio();

        room.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (pub.track && pub.kind === Track.Kind.Audio) {
              void attachRemoteAudio(pub.track as RemoteTrack);
            }
          });
        });
        syncPeers();

        const micTrack = await createLocalAudioTrack({
          ...CALL_AUDIO_CONSTRAINTS,
          deviceId: micIdRef.current || undefined,
        });
        localMicRef.current = micTrack;
        await room.localParticipant.publishTrack(micTrack, {
          source: Track.Source.Microphone,
        });

        if (speakerIdRef.current) {
          await applySpeakerOutput(speakerIdRef.current);
        }

        reconnectAttemptRef.current = 0;
        setMuted(false);
        setRoomState("connected");
        setScreenHint(false);
      } catch (e) {
        teardownRoom();
        if (callDesiredRef.current && !intentionalEndRef.current) {
          setRoomState("reconnecting");
          setRoomError(micErrorMessage(e));
          scheduleReconnect();
        } else {
          setRoomState("error");
          setRoomError(micErrorMessage(e));
        }
      } finally {
        connectingRef.current = false;
      }

      function scheduleReconnect() {
        if (intentionalEndRef.current || !callDesiredRef.current) return;
        if (reconnectTimerRef.current != null) return;
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(15000, 1000 * Math.pow(2, Math.min(attempt, 4)));
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          void connectCallRef.current({ reconnect: true });
        }, delay);
      }
    },
    [
      applySpeakerOutput,
      attachRemoteAudio,
      fetchFreshLivekit,
      playKeepAliveAudio,
      refreshDevices,
      startKeepAwake,
      stopKeepAwake,
      teardownRoom,
    ]
  );

  const connectCallRef = useRef(connectCall);
  connectCallRef.current = connectCall;

  useEffect(() => {
    return () => {
      intentionalEndRef.current = true;
      callDesiredRef.current = false;
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wantListeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      keepAliveAudioRef.current?.pause();
      stopKeepAwake();
      teardownRoom();
    };
  }, [stopKeepAwake, teardownRoom]);

  useEffect(() => {
    if (roomState === "connected" && speakerId) {
      void applySpeakerOutput(speakerId);
    }
  }, [speakerId, roomState, applySpeakerOutput]);

  // Resume when phone unlocks — do not end the lesson
  useEffect(() => {
    if (!callDesiredRef.current) return;

    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        setScreenHint(true);
        try {
          recognitionRef.current?.stop();
        } catch {
          /* ignore */
        }
        setListening(false);
        return;
      }

      unlockSafariScroll();
      window.setTimeout(unlockSafariScroll, 150);
      window.setTimeout(unlockSafariScroll, 500);

      void playKeepAliveAudio();
      void startKeepAwake();

      const room = roomRef.current;
      if (room && room.state === "connected") {
        void room.startAudio().catch(() => undefined);
        room.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (pub.track && pub.kind === Track.Kind.Audio) {
              void attachRemoteAudio(pub.track as RemoteTrack);
            }
          });
        });
        const rec = recognitionRef.current;
        if (rec && wantListeningRef.current) {
          window.setTimeout(() => {
            if (document.visibilityState !== "visible") return;
            try {
              rec.start();
              setListening(true);
            } catch {
              /* already started */
            }
          }, 400);
        }
        return;
      }

      // Dropped while locked — bring call back without user tapping again
      if (callDesiredRef.current && !intentionalEndRef.current) {
        void connectCallRef.current({ reconnect: true });
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [attachRemoteAudio, playKeepAliveAudio, startKeepAwake, roomState]);

  async function switchMic(nextId: string) {
    setMicId(nextId);
    const room = roomRef.current;
    if (!room || roomState !== "connected") return;
    try {
      const prev = localMicRef.current;
      if (prev) {
        await room.localParticipant.unpublishTrack(prev);
        prev.stop();
      }
      const micTrack = await createLocalAudioTrack({
        ...CALL_AUDIO_CONSTRAINTS,
        deviceId: nextId || undefined,
      });
      localMicRef.current = micTrack;
      await room.localParticipant.publishTrack(micTrack, {
        source: Track.Source.Microphone,
      });
      setMuted(false);
    } catch (e) {
      setRoomError(micErrorMessage(e));
    }
  }

  async function postSegment(text: string, confidence?: number) {
    const offset_ms = Math.max(0, Date.now() - t0Ms.current);
    const payload = {
      segments: [
        {
          offset_ms,
          speaker,
          text,
          confidence: confidence ?? null,
        },
      ],
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (guestToken) headers.Authorization = `Bearer ${guestToken}`;

    const res = await fetch(
      `/api/capture/sessions/${captureSessionId}/segments`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      }
    );
    if (res.ok) {
      const data = await res.json();
      const saved = data.segments?.[0];
      setSegments((prev) => [
        ...prev,
        {
          id: saved?.id,
          offset_ms,
          speaker,
          text,
        },
      ]);
    }
  }

  useEffect(() => {
    if (roomState !== "connected") {
      wantListeningRef.current = false;
      return;
    }
    const SpeechCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) return;

    const recognition = new SpeechCtor();
    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        if (result.isFinal) {
          setInterim("");
          void postSegment(transcript, result[0].confidence);
        } else {
          interimText += transcript;
        }
      }
      if (interimText) setInterim(interimText);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setListening(false);
        wantListeningRef.current = false;
        return;
      }
      setListening(false);
    };
    recognition.onend = () => {
      if (!wantListeningRef.current || !roomRef.current) {
        setListening(false);
        return;
      }
      if (document.visibilityState !== "visible") {
        setListening(false);
        return;
      }
      window.setTimeout(() => {
        if (
          !wantListeningRef.current ||
          !roomRef.current ||
          document.visibilityState !== "visible"
        ) {
          return;
        }
        try {
          recognition.start();
          setListening(true);
        } catch {
          setListening(false);
        }
      }, 500);
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }

    return () => {
      wantListeningRef.current = false;
      try {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.stop();
      } catch {
        /* ignore */
      }
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureSessionId, speaker, guestToken, roomState]);

  async function toggleMute() {
    const track = localMicRef.current;
    const room = roomRef.current;
    const next = !muted;
    if (track) {
      if (next) track.mute();
      else track.unmute();
    } else if (room) {
      await room.localParticipant.setMicrophoneEnabled(!next);
    }
    setMuted(next);
  }

  function toggleDeafened() {
    const el = audioElRef.current;
    const next = !deafened;
    if (el) el.muted = next;
    setDeafened(next);
  }

  function handleEnd() {
    intentionalEndRef.current = true;
    callDesiredRef.current = false;
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    stopKeepAwake();
    teardownRoom();
    unlockSafariScroll();
    onEnd?.();
  }

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
  const inCall =
    roomState === "connected" ||
    roomState === "connecting" ||
    roomState === "reconnecting";

  return (
    <div className={onEnd ? "space-y-4 pb-24" : "space-y-4"}>
      <audio ref={audioElRef} autoPlay playsInline className="hidden" />
      <audio
        ref={keepAliveAudioRef}
        src="/silence.wav"
        loop
        playsInline
        preload="auto"
        className="hidden"
        aria-hidden
      />

      <div className="flex items-center justify-between rounded-xl border border-gold/20 bg-[#131C31] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-bright opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold-bright" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-bright">
            {roomState === "reconnecting" ? "Rejoining" : "Live"}
          </span>
        </div>
        <p className="text-sm text-cream/70">{displayName}</p>
        <p className="font-serif text-xl tabular-nums text-cream">
          {mm}:{ss}
        </p>
      </div>

      {joinCode && joinUrl && (
        <div className="rounded-xl border border-gold/20 bg-[#131C31] p-4 space-y-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cream/40">
            Trainer join code
          </p>
          <p className="font-serif text-3xl tracking-[0.2em] text-gold">
            {joinCode}
          </p>
          <JoinQr url={joinUrl} />
          <p className="break-all text-xs text-cream/45">{joinUrl}</p>
          <p className="text-xs text-cream/50">
            Trainer opens the link on their phone — headset call, no account.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-gold/15 bg-[#131C31] px-4 py-3 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cream/40">
          Headset call
        </p>

        {!livekitProp.configured && roomState === "idle" ? (
          <p className="text-sm text-cream/70">
            Add LiveKit env vars and redeploy to enable the call.
          </p>
        ) : roomState === "idle" || roomState === "error" ? (
          <div className="space-y-2">
            <p className="text-sm text-cream/80">
              Start once — Vector keeps the lesson open and reconnects if the
              phone sleeps. For the most reliable ride, leave this screen on
              (Auto-Lock: Never) with the phone mounted.
            </p>
            {roomError && (
              <p className="text-sm text-destructive">{roomError}</p>
            )}
            <button
              type="button"
              onClick={() => void connectCall()}
              className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-navy hover:bg-gold-bright"
            >
              Start headset call
            </button>
          </div>
        ) : roomState === "connecting" ? (
          <p className="text-sm text-cream/70">Connecting call…</p>
        ) : roomState === "reconnecting" ? (
          <div className="space-y-1">
            <p className="text-sm text-gold">
              Still in lesson — reconnecting call automatically…
            </p>
            <p className="text-xs text-cream/50">
              You do not need to tap again. Timer and timeline stay with this
              lesson.
            </p>
            {roomError && (
              <p className="text-xs text-cream/45">{roomError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-cream/90">
              {peerConnected
                ? `On call with ${peerLabel}`
                : `In call — waiting for ${peerLabel}…`}
            </p>
            <p className="text-xs text-cream/45">
              Transcript:{" "}
              {listening
                ? "listening…"
                : "pauses if the screen locks — call stays on this lesson"}
            </p>
            {screenHint && (
              <p className="text-xs text-gold/80">
                Tip: Settings → Display → Auto-Lock → Never while riding, so
                Safari does not suspend the tab.
              </p>
            )}

            {(mics.length > 0 || speakers.length > 0) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {mics.length > 0 && (
                  <label className="space-y-1 text-xs text-cream/50">
                    Microphone
                    <select
                      value={micId}
                      onChange={(e) => void switchMic(e.target.value)}
                      className="w-full rounded-md border border-gold/20 bg-navy px-2 py-1.5 text-cream"
                    >
                      {mics.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {speakers.length > 0 && (
                  <label className="space-y-1 text-xs text-cream/50">
                    Headphones / speaker
                    <select
                      value={speakerId}
                      onChange={(e) => setSpeakerId(e.target.value)}
                      className="w-full rounded-md border border-gold/20 bg-navy px-2 py-1.5 text-cream"
                    >
                      {speakers.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {inCall && roomState === "connected" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void toggleMute()}
              className="rounded-lg border border-gold/25 px-3 py-1.5 text-xs text-cream hover:bg-cream/5"
            >
              Mic {muted ? "off" : "on"}
            </button>
            <button
              type="button"
              onClick={toggleDeafened}
              className="rounded-lg border border-gold/25 px-3 py-1.5 text-xs text-cream hover:bg-cream/5"
            >
              Ear {deafened ? "off" : "on"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-gold/15 bg-[#131C31] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cream/40">
          Timeline
        </p>
        {segments.length === 0 && !interim && (
          <p className="text-sm text-cream/40">
            Speaking will appear here with timestamps.
          </p>
        )}
        {segments.map((s, i) => (
          <div key={s.id || `${s.offset_ms}-${i}`} className="text-sm">
            <span className="tabular-nums text-gold/80">
              {formatOffset(s.offset_ms)}
            </span>{" "}
            <span className="text-[10px] uppercase tracking-wider text-cream/40">
              {s.speaker}
            </span>
            <p className="text-cream/90">{s.text}</p>
          </div>
        ))}
        {interim && <p className="text-sm italic text-cream/45">{interim}</p>}
      </div>

      {onEnd && (
        <div
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-gold/20 bg-navy/95 px-4 pt-3 backdrop-blur-md"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <button
            type="button"
            onClick={handleEnd}
            disabled={ending}
            className="w-full rounded-lg bg-gold px-4 py-3.5 text-sm font-semibold text-navy hover:bg-gold-bright disabled:opacity-50"
          >
            {ending ? "Saving…" : "End lesson"}
          </button>
        </div>
      )}
    </div>
  );
}

function JoinQr({ url }: { url: string }) {
  const [Qr, setQr] = useState<
    React.ComponentType<{ value: string; size?: number }> | null
  >(null);
  useEffect(() => {
    void import("qrcode.react").then((mod) => {
      setQr(
        () =>
          mod.QRCodeSVG as React.ComponentType<{ value: string; size?: number }>
      );
    });
  }, []);
  if (!Qr) {
    return (
      <div className="mx-auto h-40 w-40 animate-pulse rounded-lg bg-cream/5" />
    );
  }
  return (
    <div className="mx-auto inline-flex rounded-lg bg-cream p-3">
      <Qr value={url} size={160} />
    </div>
  );
}
