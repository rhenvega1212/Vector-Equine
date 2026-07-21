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

const CALL_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
  channelCount: 1,
} as const;

export function CaptureRoom({
  captureSessionId,
  t0,
  speaker,
  displayName,
  livekit,
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
    "idle" | "connecting" | "connected" | "error"
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

  const roomRef = useRef<Room | null>(null);
  const localMicRef = useRef<LocalAudioTrack | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const t0Ms = useRef(new Date(t0).getTime());

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
      /* needs user gesture — Start call already happened */
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
      /* browser may block sink switch */
    }
  }, []);

  async function startCall() {
    if (!livekit.configured || !livekit.url || !livekit.token) {
      setRoomError("LiveKit is not configured. Add LIVEKIT_* to .env.local and restart.");
      setRoomState("error");
      return;
    }
    if (roomRef.current) return;

    setRoomState("connecting");
    setRoomError(null);

    try {
      // Unlock devices + labels with a user gesture (required for call / headphones)
      await navigator.mediaDevices.getUserMedia({
        audio: { ...CALL_AUDIO_CONSTRAINTS },
        video: false,
      }).then((s) => s.getTracks().forEach((t) => t.stop()));

      await refreshDevices();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
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
      room.on(RoomEvent.Disconnected, () => {
        setRoomState("idle");
        setPeerConnected(false);
      });

      await room.connect(livekit.url, livekit.token);

      // Attach any tracks already in the room (late join)
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
        deviceId: micId || undefined,
      });
      localMicRef.current = micTrack;
      await room.localParticipant.publishTrack(micTrack, {
        source: Track.Source.Microphone,
      });

      if (speakerId) await applySpeakerOutput(speakerId);

      setMuted(false);
      setRoomState("connected");
    } catch (e) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      localMicRef.current?.stop();
      localMicRef.current = null;
      setRoomState("error");
      setRoomError(e instanceof Error ? e.message : "Could not start call");
    }
  }

  useEffect(() => {
    return () => {
      localMicRef.current?.stop();
      localMicRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (roomState === "connected" && speakerId) {
      void applySpeakerOutput(speakerId);
    }
  }, [speakerId, roomState, applySpeakerOutput]);

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
      setRoomError(e instanceof Error ? e.message : "Could not switch mic");
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

    const res = await fetch(`/api/capture/sessions/${captureSessionId}/segments`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
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
    if (roomState !== "connected") return;
    const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) return;

    const recognition = new SpeechCtor();
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

    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      // Keep listening during the call
      if (roomRef.current) {
        try {
          recognition.start();
          setListening(true);
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }

    return () => {
      try {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.stop();
      } catch {
        /* ignore */
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

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="space-y-4">
      <audio ref={audioElRef} autoPlay playsInline className="hidden" />

      <div className="flex items-center justify-between rounded-xl border border-gold/20 bg-[#131C31] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-bright opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold-bright" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-bright">
            Live
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
          <p className="font-serif text-3xl tracking-[0.2em] text-gold">{joinCode}</p>
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

        {!livekit.configured ? (
          <p className="text-sm text-cream/70">
            Add <code className="text-gold/80">LIVEKIT_URL</code>,{" "}
            <code className="text-gold/80">LIVEKIT_API_KEY</code>, and{" "}
            <code className="text-gold/80">LIVEKIT_API_SECRET</code> to{" "}
            <code className="text-gold/80">.env.local</code>, then restart the
            dev server.
          </p>
        ) : roomState === "idle" || roomState === "error" ? (
          <div className="space-y-2">
            <p className="text-sm text-cream/80">
              Plug in headphones, then start the call. Echo cancel is on so you
              can hear {peerLabel} without feedback.
            </p>
            {roomError && (
              <p className="text-sm text-destructive">{roomError}</p>
            )}
            <button
              type="button"
              onClick={() => void startCall()}
              className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-navy hover:bg-gold-bright"
            >
              Start headset call
            </button>
          </div>
        ) : roomState === "connecting" ? (
          <p className="text-sm text-cream/70">Connecting call…</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-cream/90">
              {peerConnected
                ? `On call with ${peerLabel}`
                : `In call — waiting for ${peerLabel}…`}
            </p>
            <p className="text-xs text-cream/45">
              Transcript: {listening ? "listening…" : "speech unavailable in this browser"}
            </p>

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

        <div className="flex flex-wrap gap-2 pt-1">
          {roomState === "connected" && (
            <>
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
            </>
          )}
          {onEnd && (
            <button
              type="button"
              onClick={onEnd}
              disabled={ending}
              className="ml-auto rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-50"
            >
              {ending ? "Saving…" : "End lesson"}
            </button>
          )}
        </div>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-gold/15 bg-[#131C31] px-4 py-3">
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
