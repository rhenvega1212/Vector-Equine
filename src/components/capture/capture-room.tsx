"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  ConnectionQuality,
  createLocalAudioTrack,
  LocalAudioTrack,
  type RemoteTrack,
} from "livekit-client";
import { formatOffset } from "@/lib/capture/summary";
import { createKeepAwake, type KeepAwakeHandle } from "@/lib/capture/keep-awake";
import {
  createSegmentOutbox,
  newClientId,
  type SegmentOutbox,
} from "@/lib/capture/segment-outbox";
import {
  newChunkId,
  pickRecorderMime,
} from "@/lib/capture/lesson-recorder";
import { VoiceLevelMeter } from "@/components/capture/voice-level-meter";
import {
  speakVectorIntoCall,
  speakTextLocally,
  unlockVectorAudio,
  isVectorPlaying,
} from "@/lib/capture/play-vector-audio";
import { openBookendLine } from "@/lib/capture/vector-session";
import {
  cleanAsrText,
  isWhisperHallucination,
} from "@/lib/capture/asr-cleanup";
import {
  createCalledTurnRuntime,
  type CalledTurnRuntime,
} from "@/lib/capture/called-turn-runtime";
import { splitWakeUtterance } from "@/lib/capture/wake-word";
import { useFeatureFlag } from "@/lib/flags/context";

type LivekitCreds = {
  configured: boolean;
  url: string | null;
  token: string | null;
};

type Segment = {
  id?: string;
  offset_ms: number;
  speaker: "rider" | "trainer" | "system" | "vector";
  text: string;
};

type MediaDeviceRow = { deviceId: string; label: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionAlt = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlt;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
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

/** First slice short — words on the timeline within ~2s of speaking. */
const WHISPER_FIRST_CHUNK_MS = 1_600;
/** Ongoing slices — complete files via stop/restart (not timeslice). */
const WHISPER_CHUNK_MS = 2_200;

function mergeSegments(prev: Segment[], incoming: Segment[]): Segment[] {
  const softKey = (s: Segment) => `${s.speaker}:${s.offset_ms}:${s.text}`;
  const byKey = new Map<string, Segment>();

  for (const s of [...prev, ...incoming]) {
    if (!s.text?.trim()) continue;
    if (s.id) {
      for (const [k, v] of Array.from(byKey.entries())) {
        if (!v.id && softKey(v) === softKey(s)) byKey.delete(k);
      }
      byKey.set(s.id, { ...byKey.get(s.id), ...s });
      continue;
    }
    let hasCanonical = false;
    for (const v of Array.from(byKey.values())) {
      if (v.id && softKey(v) === softKey(s)) {
        hasCanonical = true;
        break;
      }
    }
    if (!hasCanonical) byKey.set(softKey(s), s);
  }

  return Array.from(byKey.values()).sort((a, b) => a.offset_ms - b.offset_ms);
}

/** Skip Whisper paint when live ASR already has the same line nearby. */
function hasNearbySameLine(
  prev: Segment[],
  speaker: Segment["speaker"],
  offsetMs: number,
  text: string
): boolean {
  const needle = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!needle) return true;
  return prev.some((s) => {
    if (s.speaker !== speaker) return false;
    if (Math.abs(s.offset_ms - offsetMs) > 6_000) return false;
    const have = s.text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!have) return false;
    if (have === needle) return true;
    if (have.length > 12 && needle.includes(have)) return true;
    if (needle.length > 12 && have.includes(needle)) return true;
    return false;
  });
}

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
  autoStart = false,
  /** Mic stream opened on the Allow tap — keeps the Safari gesture chain. */
  seedMicStream = null as MediaStream | null,
  /** Parent clears the Allow-tap stream when the lesson ends. */
  onReleaseMic,
  onLessonClosed,
  riderFirstName = null,
  trainerFirstName = null,
  /** When false, no-wake escape: no strip hint / ON-OFF. Bookends still play if vectorInSession. */
  wakeArmed = true,
  vectorInSession: vectorInSessionProp,
  /** Lab test lesson — force Vector bookends on for founders. */
  isTestLesson = false,
  /** solo = arm capture without waiting for a peer. */
  rideMode = "with_trainer" as "solo" | "with_trainer",
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
  onEnd?: (result: {
    training_session_id?: string;
    ended_by?: string;
  }) => void | Promise<void>;
  ending?: boolean;
  autoStart?: boolean;
  seedMicStream?: MediaStream | null;
  onReleaseMic?: () => void;
  onLessonClosed?: (info: {
    remote: boolean;
    training_session_id?: string | null;
  }) => void;
  riderFirstName?: string | null;
  trainerFirstName?: string | null;
  wakeArmed?: boolean;
  vectorInSession?: boolean;
  isTestLesson?: boolean;
  rideMode?: "solo" | "with_trainer";
}) {
  const flagVector = useFeatureFlag("vector_in_session");
  // Guests + Lab tests always run bookends; riders need the flag (or test mode).
  const vectorInSession =
    vectorInSessionProp !== undefined
      ? vectorInSessionProp
      : isTestLesson || Boolean(guestToken) || flagVector;
  const isSolo = rideMode === "solo";
  const [roomState, setRoomState] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "error"
  >("idle");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const peerReady = isSolo || peerConnected;
  const [listening, setListening] = useState(false);
  const [speechUnsupported, setSpeechUnsupported] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState("");
  const [peerInterim, setPeerInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [mics, setMics] = useState<MediaDeviceRow[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceRow[]>([]);
  const [micId, setMicId] = useState<string>("");
  const [speakerId, setSpeakerId] = useState<string>("");
  const [screenHint, setScreenHint] = useState(false);
  /** Setup / join directions — collapse once the call works; ? reopens. */
  const [showConnectHelp, setShowConnectHelp] = useState(true);
  /** Lesson capture (recorder + ASR + open bookend) waits for both phones. */
  const [captureLive, setCaptureLive] = useState(false);
  /** ASR starts after open bookend so Vector voice + mic don't fight. */
  const [asrArmed, setAsrArmed] = useState(false);
  const [asrGotSpeech, setAsrGotSpeech] = useState(false);
  /** Web Speech is driving live dictation — skip Whisper chunk spam. */
  const asrLiveRef = useRef(false);
  const lastAsrAtRef = useRef(0);
  const showWakeUi = vectorInSession && wakeArmed && captureLive;
  const [meterTrack, setMeterTrack] = useState<LocalAudioTrack | null>(null);
  const [networkOffline, setNetworkOffline] = useState(false);
  const [pendingQueue, setPendingQueue] = useState(0);
  const [weakLink, setWeakLink] = useState(false);
  const [flushingEnd, setFlushingEnd] = useState(false);
  const [lessonEnded, setLessonEnded] = useState(false);
  const [endedRemote, setEndedRemote] = useState(false);
  const autoStartedRef = useRef(false);
  const soloArmingRef = useRef(false);
  /** True when localMic wraps parent seed — soft remount must not stop those tracks. */
  const micFromSeedRef = useRef(false);

  const roomRef = useRef<Room | null>(null);
  const localMicRef = useRef<LocalAudioTrack | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioElsRef = useRef<HTMLMediaElement[]>([]);
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
  const startLessonRecorderRef = useRef<(track: LocalAudioTrack) => void>(
    () => undefined
  );
  const stopLessonRecorderAndFlushRef = useRef<() => Promise<void>>(
    async () => undefined
  );
  const outboxRef = useRef<SegmentOutbox | null>(null);
  const segmentsRef = useRef<Segment[]>([]);
  const pullSegmentsRef = useRef<(() => Promise<void>) | null>(null);
  const leaveBecauseEndedRef = useRef<
    (remote: boolean, trainingSessionId?: string | null) => void
  >(() => undefined);
  const livekitRef = useRef(livekitProp);
  const micIdRef = useRef(micId);
  const speakerIdRef = useRef(speakerId);
  const deafenedRef = useRef(deafened);
  const t0Ms = useRef(new Date(t0).getTime());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunkStartRef = useRef(0);
  const recorderUploadsRef = useRef<Promise<unknown>[]>([]);
  const recorderRotateTimerRef = useRef<number | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderMimeRef = useRef<string>("");
  const recorderActiveRef = useRef(false);
  const recorderSliceCountRef = useRef(0);
  const whisperWakeFedRef = useRef<Set<string>>(new Set());
  const recorderPeakRef = useRef(0);
  const recorderMeterRafRef = useRef(0);
  const recorderMeterCtxRef = useRef<AudioContext | null>(null);
  const speakerRoleRef = useRef(speaker);
  const openBookendPlayedRef = useRef(false);
  const openBookendShownRef = useRef(false);
  const closeBookendPlayedRef = useRef(false);
  /** Open already heard (or re-spoken) while a peer was in the room */
  const openHeardOnCallRef = useRef(false);
  const captureLiveRef = useRef(false);
  const peerConnectedRef = useRef(false);
  const vectorInSessionRef = useRef(vectorInSession);
  const [vectorCalledOn, setVectorCalledOn] = useState(true);
  const [vectorStrip, setVectorStrip] = useState<"idle" | "turn">("idle");
  const [bookendLine, setBookendLine] = useState<string | null>(null);
  const lastBookendTextRef = useRef<string | null>(null);
  const vectorCalledOnRef = useRef(true);
  const calledTurnRef = useRef<CalledTurnRuntime | null>(null);
  vectorCalledOnRef.current = vectorCalledOn;

  livekitRef.current = livekitProp;
  micIdRef.current = micId;
  speakerIdRef.current = speakerId;
  deafenedRef.current = deafened;
  segmentsRef.current = segments;
  speakerRoleRef.current = speaker;
  vectorInSessionRef.current = vectorInSession;
  captureLiveRef.current = captureLive;
  peerConnectedRef.current = peerConnected;

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
    if (track.kind !== Track.Kind.Audio) return;
    // One element per track so mic + Vector can play together on the call
    const el = track.attach();
    el.autoplay = true;
    el.setAttribute("playsinline", "true");
    (el as HTMLAudioElement).muted = deafenedRef.current;
    remoteAudioElsRef.current.push(el);
    if (!el.parentElement) {
      document.body.appendChild(el);
    }
    try {
      await el.play();
    } catch {
      /* gesture already used on Start */
    }
    const sinkId = speakerIdRef.current;
    const withSink = el as HTMLMediaElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (sinkId && typeof withSink.setSinkId === "function") {
      try {
        await withSink.setSinkId(sinkId);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const detachRemoteAudio = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
    const attached = track.detach();
    for (const el of attached) {
      remoteAudioElsRef.current = remoteAudioElsRef.current.filter((x) => x !== el);
      el.remove();
    }
  }, []);

  const applySpeakerOutput = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    const els = [
      audioElRef.current,
      ...remoteAudioElsRef.current,
    ].filter(Boolean) as Array<
      HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }
    >;
    for (const el of els) {
      if (typeof el.setSinkId !== "function") continue;
      try {
        await el.setSinkId(deviceId);
      } catch {
        /* ignore */
      }
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
    // Do not clear screenHint here — riders need time to read Auto-Lock / mic help
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
    if (res.status === 410) {
      const data = await res.json().catch(() => ({}));
      leaveBecauseEndedRef.current(true, data.training_session_id ?? null);
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    return data.livekit as LivekitCreds;
  }, [captureSessionId, guestToken]);

  const stopLocalMicHard = useCallback(() => {
    const track = localMicRef.current;
    localMicRef.current = null;
    micFromSeedRef.current = false;
    setMeterTrack(null);
    if (!track) return;
    try {
      track.mediaStreamTrack?.stop();
    } catch {
      /* ignore */
    }
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const teardownRoom = useCallback((opts?: { stopMic?: boolean }) => {
    const stopMic = opts?.stopMic !== false;
    if (stopMic) {
      stopLocalMicHard();
    } else if (micFromSeedRef.current) {
      // Parent still owns the MediaStreamTrack — drop our wrapper only
      localMicRef.current = null;
      setMeterTrack(null);
    } else {
      // We opened this track — don't orphan it across remounts
      stopLocalMicHard();
    }
    for (const el of remoteAudioElsRef.current) {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    }
    remoteAudioElsRef.current = [];
    try {
      roomRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    roomRef.current = null;
  }, [stopLocalMicHard]);

  /** Hardware off — ASR, recorder, LiveKit mic, and parent seed stream. */
  const releaseAllMics = useCallback(() => {
    wantListeningRef.current = false;
    setAsrArmed(false);
    setCaptureLive(false);
    captureLiveRef.current = false;
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    mediaRecorderRef.current = null;
    recorderActiveRef.current = false;
    if (recorderRotateTimerRef.current != null) {
      window.clearTimeout(recorderRotateTimerRef.current);
      recorderRotateTimerRef.current = null;
    }
    teardownRoom({ stopMic: true });
    onReleaseMic?.();
  }, [onReleaseMic, teardownRoom]);

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
        await unlockVectorAudio();
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
        } catch (micErr) {
          if (!opts?.reconnect) {
            throw micErr instanceof Error
              ? micErr
              : new Error(micErrorMessage(micErr));
          }
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
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          detachRemoteAudio(track as RemoteTrack);
        });
        room.on(RoomEvent.ParticipantConnected, () => {
          syncPeers();
          // Catch peer up on cues they missed while alone in the room
          try {
            for (const seg of segmentsRef.current.slice(-40)) {
              if (!seg.text?.trim()) continue;
              const bytes = new TextEncoder().encode(
                JSON.stringify({
                  type: "segment",
                  id: seg.id,
                  offset_ms: seg.offset_ms,
                  speaker: seg.speaker,
                  text: seg.text,
                  interim: false,
                })
              );
              void room.localParticipant.publishData(bytes, { reliable: true });
            }
            if (openBookendPlayedRef.current && lastBookendTextRef.current) {
              broadcastVectorBookend("open", lastBookendTextRef.current);
            }
          } catch {
            /* ignore */
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, syncPeers);
        room.on(RoomEvent.DataReceived, (payload) => {
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload)) as {
              type?: string;
              id?: string;
              offset_ms?: number;
              speaker?: Segment["speaker"];
              text?: string;
              interim?: boolean;
              training_session_id?: string;
              kind?: string;
            };
            if (msg.type === "session_ended") {
              leaveBecauseEndedRef.current(
                true,
                msg.training_session_id ?? null
              );
              return;
            }
            if (msg.type === "vector_bookend" && msg.text) {
              const kind = msg.kind === "close" ? "close" : "open";
              if (kind === "open" && openBookendPlayedRef.current) return;
              if (kind === "close" && closeBookendPlayedRef.current) return;
              if (kind === "open") openBookendPlayedRef.current = true;
              if (kind === "close") closeBookendPlayedRef.current = true;
              // Text on both screens; audio arrives on the LiveKit shared mix
              setBookendLine(msg.text);
              lastBookendTextRef.current = msg.text;
              if (kind === "open") {
                window.setTimeout(() => setBookendLine(null), 8000);
              }
              return;
            }
            if (msg.type === "vector_turn" && msg.text) {
              calledTurnRef.current?.onRemoteTurn(msg.text);
              return;
            }
            if (msg.type === "vector_stop") {
              calledTurnRef.current?.onRemoteStop();
              return;
            }
            if (msg.type === "vector_called_on" && typeof (msg as { on?: boolean }).on === "boolean") {
              setVectorCalledOn(Boolean((msg as { on: boolean }).on));
              return;
            }
            if (msg.type !== "segment" || !msg.speaker) return;
            // Don't echo our own speech back into the timeline twice
            if (msg.speaker === speaker) return;
            if (msg.interim) {
              setPeerInterim(msg.text || "");
              return;
            }
            if (!msg.text) return;
            const peerSpeaker = msg.speaker;
            const peerText = msg.text;
            setPeerInterim("");
            setSegments((prev) =>
              mergeSegments(prev, [
                {
                  id: msg.id,
                  offset_ms:
                    msg.offset_ms ?? Math.max(0, Date.now() - t0Ms.current),
                  speaker: peerSpeaker,
                  text: peerText,
                },
              ])
            );
          } catch {
            /* ignore malformed */
          }
        });
        room.on(RoomEvent.Reconnecting, () => {
          if (!intentionalEndRef.current) setRoomState("reconnecting");
        });
        room.on(RoomEvent.Reconnected, () => {
          setRoomState("connected");
          reconnectAttemptRef.current = 0;
          void playKeepAliveAudio();
          void startKeepAwake();
          outboxRef.current?.kick();
          void pullSegmentsRef.current?.();
        });
        room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
          if (participant !== room.localParticipant) return;
          setWeakLink(
            quality === ConnectionQuality.Poor ||
              quality === ConnectionQuality.Lost
          );
        });
        room.on(RoomEvent.Disconnected, () => {
          setPeerConnected(false);
          roomRef.current = null;
          localMicRef.current?.stop();
          localMicRef.current = null;
          setMeterTrack(null);
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
        setMeterTrack(micTrack);
        await room.localParticipant.publishTrack(micTrack, {
          source: Track.Source.Microphone,
        });

        // Brief 14: capture starts only when both phones are on the call
        if (opts?.reconnect && captureLiveRef.current) {
          startLessonRecorderRef.current(micTrack);
        }

        if (speakerIdRef.current) {
          await applySpeakerOutput(speakerIdRef.current);
        }

        reconnectAttemptRef.current = 0;
        setMuted(false);
        setRoomState("connected");
        setScreenHint(false);
      } catch (e) {
        teardownRoom();
        const msg = micErrorMessage(e);
        const micBlocked = /Microphone blocked|No microphone/i.test(msg);
        if (micBlocked) {
          setScreenHint(true);
          callDesiredRef.current = false;
          setRoomState("error");
          setRoomError(msg);
        } else if (callDesiredRef.current && !intentionalEndRef.current) {
          setRoomState("reconnecting");
          setRoomError(msg);
          scheduleReconnect();
        } else {
          setRoomState("error");
          setRoomError(msg);
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
      detachRemoteAudio,
      captureSessionId,
      fetchFreshLivekit,
      guestToken,
      playKeepAliveAudio,
      refreshDevices,
      riderFirstName,
      startKeepAwake,
      stopKeepAwake,
      teardownRoom,
      trainerFirstName,
      speaker,
    ]
  );

  connectCallRef.current = connectCall;

  // With a trainer: auto-join LiveKit. Solo: skip the call — mic + Vector arm locally.
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    if (isSolo) {
      autoStartedRef.current = true;
      return;
    }
    if (!livekitProp.configured) return;
    autoStartedRef.current = true;
    void connectCallRef.current();
  }, [autoStart, livekitProp.configured, isSolo]);

  // Solo ride: arm once from Allow stream or autoStart — survive Strict Mode remounts.
  useEffect(() => {
    if (!isSolo) return;
    if (!autoStart && !seedMicStream) return;
    if (captureLiveRef.current || intentionalEndRef.current) return;
    if (soloArmingRef.current) return;
    soloArmingRef.current = true;

    let abandoned = false;

    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error(`${label} timed out`)), ms)
        ),
      ]);

    void (async () => {
      try {
        // Audio unlock can hang in embedded browsers — never block arming on it
        await Promise.race([
          unlockVectorAudio(),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
        void startKeepAwake();
        if (abandoned || intentionalEndRef.current) return;

        let track = localMicRef.current;
        if (!track && seedMicStream) {
          const media = seedMicStream.getAudioTracks()[0];
          if (media && media.readyState === "live") {
            track = new LocalAudioTrack(media);
            localMicRef.current = track;
            micFromSeedRef.current = true;
            setMeterTrack(track);
          }
        }
        if (!track) {
          track = await withTimeout(
            createLocalAudioTrack({
              ...CALL_AUDIO_CONSTRAINTS,
              deviceId: micIdRef.current || undefined,
            }),
            8000,
            "Microphone"
          );
          if (abandoned || intentionalEndRef.current) {
            try {
              track.mediaStreamTrack?.stop();
              track.stop();
            } catch {
              /* ignore */
            }
            return;
          }
          localMicRef.current = track;
          micFromSeedRef.current = false;
          setMeterTrack(track);
        }

        // Mark live immediately — don't wait on bookend or remount cancel
        if (captureLiveRef.current) return;
        captureLiveRef.current = true;
        setCaptureLive(true);
        setRoomError(null);
        setShowConnectHelp(false);

        // Capture first — open line speaks in parallel (ASR already waits while Vector plays)
        showOpenBookendNow();
        void speakOpenBookend();
        startLessonRecorderRef.current(track);
        setAsrArmed(true);
      } catch (e) {
        soloArmingRef.current = false;
        if (!intentionalEndRef.current && !abandoned) {
          setRoomError(micErrorMessage(e));
          captureLiveRef.current = false;
          setCaptureLive(false);
          setAsrArmed(false);
        }
      }
    })();
    return () => {
      // Strict Mode remount — keep seed/parent mic; clear arm lock so remount can retry
      abandoned = true;
      if (!captureLiveRef.current) {
        soloArmingRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolo, autoStart, seedMicStream]);

  async function openSoloMicFromTap() {
    if (!isSolo || captureLiveRef.current || intentionalEndRef.current) return;
    setRoomError(null);
    soloArmingRef.current = true;
    try {
      await Promise.race([
        unlockVectorAudio(),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
      void startKeepAwake();
      let track = localMicRef.current;
      if (!track && seedMicStream) {
        const media = seedMicStream.getAudioTracks()[0];
        if (media && media.readyState === "live") {
          track = new LocalAudioTrack(media);
          micFromSeedRef.current = true;
        }
      }
      if (!track) {
        track = await createLocalAudioTrack({
          ...CALL_AUDIO_CONSTRAINTS,
          deviceId: micIdRef.current || undefined,
        });
        micFromSeedRef.current = false;
      }
      if (intentionalEndRef.current) {
        try {
          track.mediaStreamTrack?.stop();
          track.stop();
        } catch {
          /* ignore */
        }
        return;
      }
      localMicRef.current = track;
      setMeterTrack(track);
      captureLiveRef.current = true;
      setCaptureLive(true);
      setShowConnectHelp(false);
      showOpenBookendNow();
      void speakOpenBookend();
      if (intentionalEndRef.current) return;
      startLessonRecorderRef.current(track);
      setAsrArmed(true);
    } catch (e) {
      soloArmingRef.current = false;
      setRoomError(micErrorMessage(e));
      captureLiveRef.current = false;
      setCaptureLive(false);
      setAsrArmed(false);
    }
  }

  useEffect(() => {
    return () => {
      // Soft unmount (Strict Mode remount or navigate). Do NOT kill the parent
      // seed stream here — that left autoStart true with a dead mic and hung
      // on "Opening mic…". Parent releaseMic / handleEnd call releaseAllMics.
      callDesiredRef.current = false;
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wantListeningRef.current = false;
      setAsrArmed(false);
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current = null;
      recorderActiveRef.current = false;
      if (recorderRotateTimerRef.current != null) {
        window.clearTimeout(recorderRotateTimerRef.current);
        recorderRotateTimerRef.current = null;
      }
      keepAliveAudioRef.current?.pause();
      outboxRef.current?.destroy();
      outboxRef.current = null;
      stopKeepAwake();
      // Disconnect call only — leave seed MediaStream for remount / parent ownership
      teardownRoom({ stopMic: false });
    };
  }, [stopKeepAwake, teardownRoom]);

  // Barn WiFi: reconnect immediately when radio returns; surface offline state
  useEffect(() => {
    const syncOnline = () => {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setNetworkOffline(offline);
      if (!offline) {
        reconnectAttemptRef.current = 0;
        if (reconnectTimerRef.current != null) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        outboxRef.current?.kick();
        if (
          callDesiredRef.current &&
          !intentionalEndRef.current &&
          (!roomRef.current || roomRef.current.state !== "connected")
        ) {
          void connectCallRef.current({ reconnect: true });
        }
      }
    };
    setNetworkOffline(
      typeof navigator !== "undefined" && navigator.onLine === false
    );
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

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
      setMeterTrack(micTrack);
      await room.localParticipant.publishTrack(micTrack, {
        source: Track.Source.Microphone,
      });
      setMuted(false);
    } catch (e) {
      setRoomError(micErrorMessage(e));
    }
  }

  const authHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (guestToken) headers.Authorization = `Bearer ${guestToken}`;
    return headers;
  }, [guestToken]);

  // Called turns — arm with capture; ON/OFF silences wake only
  useEffect(() => {
    if (!showWakeUi) {
      calledTurnRef.current?.dispose();
      calledTurnRef.current = null;
      return;
    }
    const runtime = createCalledTurnRuntime({
      getRoom: () => roomRef.current,
      getCaptureSessionId: () => captureSessionId,
      getAuthHeaders: authHeaders,
      getAskedBy: () => speakerRoleRef.current,
      getRiderFirst: () => riderFirstName,
      getTrainerFirst: () => trainerFirstName,
      getOffsetMs: () => Math.max(0, Date.now() - t0Ms.current),
      isArmed: () =>
        vectorCalledOnRef.current &&
        captureLiveRef.current &&
        vectorInSessionRef.current,
      isCaptureLive: () => captureLiveRef.current,
      onUi: (ui) => {
        if (ui.strip) setVectorStrip(ui.strip);
        if (ui.line !== undefined) {
          setBookendLine(ui.line);
          if (ui.line) lastBookendTextRef.current = ui.line;
        }
      },
      broadcast: (msg) => {
        const room = roomRef.current;
        if (!room || room.state !== "connected") return;
        try {
          const bytes = new TextEncoder().encode(JSON.stringify(msg));
          void room.localParticipant.publishData(bytes, { reliable: true });
        } catch {
          /* ignore */
        }
      },
    });
    calledTurnRef.current = runtime;
    return () => {
      runtime.dispose();
      if (calledTurnRef.current === runtime) calledTurnRef.current = null;
    };
  }, [
    showWakeUi,
    captureSessionId,
    authHeaders,
    riderFirstName,
    trainerFirstName,
  ]);

  function toggleVectorCalledOn() {
    setVectorCalledOn((v) => {
      const next = !v;
      const room = roomRef.current;
      if (room && room.state === "connected") {
        try {
          const bytes = new TextEncoder().encode(
            JSON.stringify({ type: "vector_called_on", on: next })
          );
          void room.localParticipant.publishData(bytes, { reliable: true });
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  async function playCloseBookend() {
    if (!vectorInSessionRef.current || closeBookendPlayedRef.current) return;
    closeBookendPlayedRef.current = true;
    try {
      const result = await speakVectorIntoCall(
        roomRef.current,
        captureSessionId,
        {
          kind: "close",
          offsetMs: Math.max(0, Date.now() - t0Ms.current),
        },
        authHeaders
      );
      if (result.text) {
        setBookendLine(result.text);
        lastBookendTextRef.current = result.text;
        broadcastVectorBookend("close", result.text);
      }
    } catch {
      /* ignore */
    }
  }

  function showOpenBookendNow() {
    if (!vectorInSessionRef.current || openBookendShownRef.current) return;
    openBookendShownRef.current = true;
    const preview = openBookendLine({
      riderFirst: riderFirstName,
      trainerFirst: trainerFirstName,
    });
    setBookendLine(preview);
    lastBookendTextRef.current = preview;
    // Timeline immediately — don't wait for ElevenLabs / mic
    setSegments((prev) =>
      mergeSegments(prev, [
        { offset_ms: 0, speaker: "vector", text: preview },
      ])
    );
    window.setTimeout(() => {
      setBookendLine((cur) => (cur === preview ? null : cur));
    }, 10000);
  }

  async function speakOpenBookend() {
    if (!vectorInSessionRef.current || openBookendPlayedRef.current) return;
    openBookendPlayedRef.current = true;
    showOpenBookendNow();
    try {
      await unlockVectorAudio();
      const result = await speakVectorIntoCall(
        roomRef.current,
        captureSessionId,
        {
          kind: "open",
          riderFirst: riderFirstName,
          trainerFirst: trainerFirstName,
          offsetMs: Math.max(0, Date.now() - t0Ms.current),
        },
        () => {
          const h: Record<string, string> = {};
          if (guestToken) h.Authorization = `Bearer ${guestToken}`;
          return h;
        }
      );
      if (result.text) {
        setBookendLine(result.text);
        lastBookendTextRef.current = result.text;
        broadcastVectorBookend("open", result.text);
        if (roomRef.current && roomRef.current.remoteParticipants.size > 0) {
          openHeardOnCallRef.current = true;
        }
        setSegments((prev) =>
          mergeSegments(prev, [
            { offset_ms: 0, speaker: "vector", text: result.text },
          ])
        );
        // Open line must be heard — retry local voice if cloud play failed
        if (!result.spoken) {
          await speakTextLocally(result.text);
        }
      }
    } catch {
      /* disclosure best-effort */
    }
  }

  /** @deprecated name kept for call sites — never blocks capture. */
  async function runOpenBookend() {
    showOpenBookendNow();
    void speakOpenBookend();
  }

  // Paint "You're on" the moment the room mounts — before mic / TTS.
  useEffect(() => {
    if (!vectorInSession) return;
    showOpenBookendNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vectorInSession, captureSessionId]);

  function broadcastVectorBookend(kind: "open" | "close", text: string) {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    try {
      const bytes = new TextEncoder().encode(
        JSON.stringify({ type: "vector_bookend", kind, text })
      );
      void room.localParticipant.publishData(bytes, { reliable: true });
    } catch {
      /* ignore */
    }
  }

  const uploadLessonAudioChunk = useCallback(
    async (blob: Blob, syncOffsetMs: number) => {
      if (blob.size < 256) return;
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("file", blob, `chunk.${ext}`);
      form.append("speaker", speakerRoleRef.current);
      form.append("sync_offset_ms", String(Math.max(0, syncOffsetMs)));
      form.append("chunk_id", newChunkId());
      const headers: Record<string, string> = {};
      if (guestToken) headers.Authorization = `Bearer ${guestToken}`;
      const res = await fetch(`/api/capture/sessions/${captureSessionId}/audio`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        console.warn("lesson audio upload failed", res.status);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        segments?: Array<{
          offset_ms: number;
          speaker: Segment["speaker"];
          text: string;
        }>;
      };
      const rows = Array.isArray(data.segments) ? data.segments : [];
      if (rows.length === 0) return;

      for (const s of rows) {
        if (s.speaker !== speakerRoleRef.current || !s.text?.trim()) continue;
        if (isWhisperHallucination(s.text)) continue;
        const cleaned = cleanAsrText(s.text);
        if (!cleaned) continue;
        // Don't paint Vector's own voice back as rider lines
        if (isVectorPlaying()) {
          const { hit } = splitWakeUtterance(cleaned);
          if (hit) {
            const key = `up:${s.offset_ms}:${cleaned}`;
            if (!whisperWakeFedRef.current.has(key)) {
              whisperWakeFedRef.current.add(key);
              calledTurnRef.current?.onAsrFinal(cleaned);
            }
          }
          continue;
        }
        const { hit } = splitWakeUtterance(cleaned);

        setAsrGotSpeech(true);
        setSegments((prev) => {
          if (hasNearbySameLine(prev, s.speaker, s.offset_ms, cleaned)) {
            return prev;
          }
          return mergeSegments(prev, [
            {
              offset_ms: s.offset_ms,
              speaker: s.speaker,
              text: cleaned,
            },
          ]);
        });

        const key = `up:${s.offset_ms}:${cleaned}`;
        if (!whisperWakeFedRef.current.has(key)) {
          whisperWakeFedRef.current.add(key);
          const asrFresh =
            asrLiveRef.current && Date.now() - lastAsrAtRef.current < 4_000;
          if (hit || !asrFresh) {
            calledTurnRef.current?.onAsrFinal(cleaned);
          }
        }
      }
    },
    [captureSessionId, guestToken]
  );

  const stopLessonRecorderAndFlush = useCallback(async () => {
    recorderActiveRef.current = false;
    if (recorderRotateTimerRef.current != null) {
      window.clearTimeout(recorderRotateTimerRef.current);
      recorderRotateTimerRef.current = null;
    }
    if (recorderMeterRafRef.current) {
      cancelAnimationFrame(recorderMeterRafRef.current);
      recorderMeterRafRef.current = 0;
    }
    try {
      await recorderMeterCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    recorderMeterCtxRef.current = null;
    const rec = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        rec.addEventListener("stop", done, { once: true });
        try {
          rec.stop();
        } catch {
          resolve();
          return;
        }
        window.setTimeout(done, 2500);
      });
    }
    recorderStreamRef.current = null;
    const pending = recorderUploadsRef.current;
    recorderUploadsRef.current = [];
    if (pending.length === 0) return;
    await Promise.race([
      Promise.allSettled(pending),
      new Promise((r) => setTimeout(r, 8000)),
    ]);
  }, []);

  const startLessonRecorder = useCallback(
    (track: LocalAudioTrack) => {
      const mime = pickRecorderMime();
      if (!mime) {
        console.warn("lesson MediaRecorder: no supported mime");
        return;
      }

      recorderActiveRef.current = false;
      if (recorderRotateTimerRef.current != null) {
        window.clearTimeout(recorderRotateTimerRef.current);
        recorderRotateTimerRef.current = null;
      }
      const prev = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (prev && prev.state !== "inactive") {
        try {
          prev.stop();
        } catch {
          /* ignore */
        }
      }

      const stream = new MediaStream([track.mediaStreamTrack]);
      recorderStreamRef.current = stream;
      recorderMimeRef.current = mime;
      recorderActiveRef.current = true;
      recorderSliceCountRef.current = 0;

      // Peak meter for this slice — skip Whisper on near-silence (stops YouTube hallucinations)
      if (recorderMeterRafRef.current) {
        cancelAnimationFrame(recorderMeterRafRef.current);
        recorderMeterRafRef.current = 0;
      }
      try {
        void recorderMeterCtxRef.current?.close();
      } catch {
        /* ignore */
      }
      recorderMeterCtxRef.current = null;
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const meterCtx = new AC();
        recorderMeterCtxRef.current = meterCtx;
        const source = meterCtx.createMediaStreamSource(stream);
        const analyser = meterCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (!recorderActiveRef.current) return;
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i++) {
            peak = Math.max(peak, Math.abs(data[i] - 128));
          }
          if (peak > recorderPeakRef.current) recorderPeakRef.current = peak;
          recorderMeterRafRef.current = requestAnimationFrame(tick);
        };
        recorderPeakRef.current = 0;
        recorderMeterRafRef.current = requestAnimationFrame(tick);
      } catch {
        /* meter optional */
      }

      const armSlice = () => {
        if (!recorderActiveRef.current || intentionalEndRef.current) return;
        const liveStream = recorderStreamRef.current;
        const liveMime = recorderMimeRef.current;
        if (!liveStream || !liveMime) return;

        try {
          const rec = new MediaRecorder(liveStream, {
            mimeType: liveMime,
            audioBitsPerSecond: 48_000,
          });
          recorderChunkStartRef.current = Math.max(0, Date.now() - t0Ms.current);
          recorderPeakRef.current = 0;
          const sliceIndex = recorderSliceCountRef.current++;
          const sliceMs =
            sliceIndex === 0 ? WHISPER_FIRST_CHUNK_MS : WHISPER_CHUNK_MS;

          rec.ondataavailable = (event) => {
            if (!event.data || event.data.size < 256) return;
            const peak = recorderPeakRef.current;
            recorderPeakRef.current = 0;
            // Quiet / vicinity murmur — don't send to Whisper (peak is |sample-128|)
            if (peak < 22) return;
            const typed =
              event.data.type && event.data.type !== ""
                ? event.data
                : new Blob([event.data], { type: liveMime.split(";")[0] });
            const sync = recorderChunkStartRef.current;
            const upload = uploadLessonAudioChunk(typed, sync).catch(
              () => undefined
            );
            recorderUploadsRef.current.push(upload);
          };

          rec.onerror = () => {
            console.warn("lesson MediaRecorder error");
          };

          rec.start();
          mediaRecorderRef.current = rec;

          recorderRotateTimerRef.current = window.setTimeout(() => {
            recorderRotateTimerRef.current = null;
            if (mediaRecorderRef.current === rec && rec.state !== "inactive") {
              try {
                rec.stop();
              } catch {
                /* ignore */
              }
            }
            window.setTimeout(() => armSlice(), 40);
          }, sliceMs);
        } catch (e) {
          console.warn("lesson MediaRecorder unavailable", e);
        }
      };

      armSlice();
    },
    [uploadLessonAudioChunk]
  );

  startLessonRecorderRef.current = startLessonRecorder;
  stopLessonRecorderAndFlushRef.current = stopLessonRecorderAndFlush;

  // With trainer: both phones on the call → open bookend, then recorder / transcript.
  // Solo arms in its own effect (no LiveKit wait).
  useEffect(() => {
    if (isSolo) return;
    if (roomState !== "connected" || !peerReady) return;
    if (captureLiveRef.current) return;
    captureLiveRef.current = true;
    setCaptureLive(true);
    setShowConnectHelp(false);
    showOpenBookendNow();
    void speakOpenBookend();
    const track = localMicRef.current;
    if (track) startLessonRecorderRef.current(track);
    setAsrArmed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomState, peerReady, isSolo]);

  const broadcastSegment = useCallback(
    (seg: Segment & { interim?: boolean }) => {
      const room = roomRef.current;
      if (!room || room.state !== "connected") return;
      try {
        const bytes = new TextEncoder().encode(
          JSON.stringify({
            type: "segment",
            id: seg.id,
            offset_ms: seg.offset_ms,
            speaker: seg.speaker,
            text: seg.text,
            interim: !!seg.interim,
          })
        );
        void room.localParticipant.publishData(bytes, { reliable: !seg.interim });
      } catch {
        /* ignore */
      }
    },
    []
  );

  // Durable segment outbox (survives brief barn WiFi drops)
  useEffect(() => {
    const outbox = createSegmentOutbox({
      captureSessionId,
      onQueueChange: setPendingQueue,
      onSaved: (saved) => {
        setSegments((prev) =>
          mergeSegments(
            prev,
            saved.map((s) => ({
              id: s.id,
              offset_ms: s.offset_ms,
              speaker: s.speaker,
              text: s.text,
            }))
          )
        );
        for (const s of saved) {
          broadcastSegment({
            id: s.id,
            offset_ms: s.offset_ms,
            speaker: s.speaker,
            text: s.text,
          });
        }
      },
      post: async (batch) => {
        try {
          const res = await fetch(
            `/api/capture/sessions/${captureSessionId}/segments`,
            {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ segments: batch }),
              keepalive: true,
            }
          );
          if (!res.ok) return { ok: false };
          const data = await res.json();
          const rows = (data.segments || []) as {
            id?: string;
            client_id?: string | null;
            offset_ms: number;
            speaker: Segment["speaker"];
            text: string;
          }[];
          const withClient = rows.map((r, i) => ({
            ...r,
            client_id: r.client_id || batch[i]?.client_id || null,
          }));
          return { ok: true, segments: withClient };
        } catch {
          return { ok: false };
        }
      },
    });
    outboxRef.current = outbox;
    return () => {
      outbox.destroy();
      if (outboxRef.current === outbox) outboxRef.current = null;
    };
  }, [authHeaders, broadcastSegment, captureSessionId]);

  const pullSegments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/capture/sessions/${captureSessionId}/segments`,
        {
          headers: authHeaders(),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      const rows = (data.segments || []) as Segment[];
      setSegments((prev) => {
        const pending = prev.filter((s) => !s.id);
        return mergeSegments(rows, pending);
      });
      for (const s of rows) {
        if (s.speaker !== speakerRoleRef.current || !s.text?.trim()) continue;
        if (isWhisperHallucination(s.text)) continue;
        const cleaned = cleanAsrText(s.text);
        if (!cleaned) continue;
        const key = s.id || `${s.offset_ms}:${cleaned}`;
        if (whisperWakeFedRef.current.has(key)) continue;
        whisperWakeFedRef.current.add(key);
        setAsrGotSpeech(true);
        calledTurnRef.current?.onAsrFinal(cleaned);
      }
    } catch {
      /* ignore timeouts / offline */
    }
  }, [authHeaders, captureSessionId]);

  pullSegmentsRef.current = pullSegments;

  function postSegment(text: string, confidence?: number) {
    const cleaned = cleanAsrText(text);
    if (!cleaned) return;
    const offset_ms = Math.max(0, Date.now() - t0Ms.current);
    const client_id = newClientId();
    const localSeg: Segment = { offset_ms, speaker, text: cleaned };
    setSegments((prev) => mergeSegments(prev, [localSeg]));
    broadcastSegment(localSeg);

    outboxRef.current?.enqueue({
      client_id,
      offset_ms,
      speaker,
      text: cleaned,
      confidence: confidence ?? null,
    });
  }

  // Shared conversation timeline — poll whenever we have a session (not only in-call)
  useEffect(() => {
    void pullSegments();
    const intervalMs =
      roomState === "reconnecting" || networkOffline || pendingQueue > 0
        ? 1200
        : captureLive && isSolo
          ? 800
          : roomState === "connected"
            ? 2500
            : 3500;
    const id = window.setInterval(() => {
      void pullSegments();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [roomState, pullSegments, networkOffline, pendingQueue, captureLive, isSolo]);

  useEffect(() => {
    // Solo: wait until open bookend finishes so Vector voice isn't cut by ASR.
    // Trainer: same, via asrArmed after peer join bookend.
    const canListen =
      captureLive && asrArmed && (isSolo || roomState === "connected");
    if (!canListen) {
      wantListeningRef.current = false;
      return;
    }
    const SpeechCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setSpeechUnsupported(true);
      setListening(false);
      return;
    }
    setSpeechUnsupported(false);

    const recognition = new SpeechCtor();
    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    try {
      // One alternative = faster partials (phone-style)
      recognition.maxAlternatives = 1;
    } catch {
      /* ignore */
    }

    let restartDelayMs = 180;
    let restartTimer: number | null = null;
    let softRestartTimer: number | null = null;

    const scheduleRestart = (delay: number) => {
      if (restartTimer != null) window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        restartTimer = null;
        const roomOk = isSolo || Boolean(roomRef.current);
        if (
          !wantListeningRef.current ||
          !roomOk ||
          document.visibilityState !== "visible"
        ) {
          setListening(false);
          return;
        }
        // Brief pause only — long waits make the transcript feel dead
        if (isVectorPlaying()) {
          scheduleRestart(220);
          return;
        }
        try {
          recognition.start();
          setListening(true);
        } catch {
          // InvalidStateError = already started — keep UI on
          setListening(true);
        }
      }, delay);
    };

    // Safari degrades on long continuous sessions — soft restart
    softRestartTimer = window.setInterval(() => {
      if (!wantListeningRef.current || !recognitionRef.current) return;
      if (isVectorPlaying()) return;
      try {
        recognition.stop();
      } catch {
        /* onend will restart */
      }
    }, 90_000);

    recognition.onresult = (event) => {
      asrLiveRef.current = true;
      lastAsrAtRef.current = Date.now();
      setAsrGotSpeech(true);
      const vectorTalking = isVectorPlaying();
      let interimText = "";
      // Rebuild from full result list — snappier than only slicing resultIndex
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = (result[0]?.transcript || "").trim();
        if (!transcript) continue;
        if (result.isFinal) {
          // Only commit newly finalized rows (from resultIndex up)
          if (i < event.resultIndex) continue;
          setInterim("");
          broadcastSegment({
            offset_ms: Math.max(0, Date.now() - t0Ms.current),
            speaker,
            text: "",
            interim: true,
          });
          const cleanedFinal = cleanAsrText(transcript);
          if (!cleanedFinal) continue;
          // While Vector speaks: only listen for stop — don't paint TTS echo
          if (vectorTalking) {
            calledTurnRef.current?.onAsrFinal(cleanedFinal);
            continue;
          }
          calledTurnRef.current?.onAsrFinal(cleanedFinal);
          void postSegment(cleanedFinal, result[0]?.confidence);
        } else if (i >= event.resultIndex) {
          // Raw partials — don't clean mid-word (keeps the caret moving with speech)
          interimText += (interimText ? " " : "") + transcript;
        }
      }
      // Fallback: any trailing non-final if resultIndex path was empty
      if (!interimText) {
        for (let i = event.results.length - 1; i >= 0; i--) {
          const result = event.results[i];
          if (result.isFinal) break;
          const transcript = (result[0]?.transcript || "").trim();
          if (!transcript) continue;
          interimText = transcript;
          break;
        }
      }
      if (interimText) {
        // Feed the turn runtime even while Vector talks — it filters its own
        // voice back out, and this is what makes barge-in feel immediate
        calledTurnRef.current?.onAsrInterim(interimText);
        if (!vectorTalking) {
          setInterim(interimText);
          broadcastSegment({
            offset_ms: Math.max(0, Date.now() - t0Ms.current),
            speaker,
            text: interimText,
            interim: true,
          });
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setListening(false);
        wantListeningRef.current = false;
        setSpeechUnsupported(true);
        asrLiveRef.current = false;
        return;
      }
      // Silence / abort are normal — quick restart so dictation stays snappy
      if (event.error === "no-speech") {
        restartDelayMs = 120;
        return;
      }
      if (event.error === "aborted") {
        restartDelayMs = isVectorPlaying() ? 220 : 100;
        return;
      }
      setListening(false);
    };
    recognition.onend = () => {
      const roomOk = isSolo || Boolean(roomRef.current);
      if (!wantListeningRef.current || !roomOk) {
        setListening(false);
        return;
      }
      if (document.visibilityState !== "visible") {
        setListening(false);
        return;
      }
      setListening(true);
      const delay = isVectorPlaying() ? 220 : Math.min(restartDelayMs, 200);
      restartDelayMs = 150;
      scheduleRestart(delay);
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      scheduleRestart(250);
    }

    return () => {
      wantListeningRef.current = false;
      if (restartTimer != null) window.clearTimeout(restartTimer);
      if (softRestartTimer != null) window.clearInterval(softRestartTimer);
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
  }, [
    captureSessionId,
    speaker,
    guestToken,
    roomState,
    captureLive,
    asrArmed,
    isSolo,
  ]);

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
    const next = !deafened;
    deafenedRef.current = next;
    if (audioElRef.current) audioElRef.current.muted = next;
    for (const el of remoteAudioElsRef.current) {
      (el as HTMLAudioElement).muted = next;
    }
    setDeafened(next);
  }

  const leaveBecauseEnded = useCallback(
    (remote: boolean, trainingSessionId?: string | null) => {
      if (lessonEnded) return;
      // Local End already in flight — don't treat status poll as a remote end
      if (intentionalEndRef.current && !remote) {
        /* continue */
      } else if (intentionalEndRef.current && remote) {
        // We initiated end; peer/status confirm — just ensure UI is closed
        setLessonEnded(true);
        setEndedRemote(false);
        return;
      }
      intentionalEndRef.current = true;
      callDesiredRef.current = false;
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      stopKeepAwake();
      // Kill hardware immediately — don't wait on flush / close bookend
      releaseAllMics();
      void (async () => {
        try {
          await stopLessonRecorderAndFlushRef.current();
        } catch {
          /* ignore */
        }
        try {
          await playCloseBookend();
        } catch {
          /* ignore */
        }
        unlockSafariScroll();
        setLessonEnded(true);
        setEndedRemote(remote);
        setRoomState("idle");
        onLessonClosed?.({
          remote,
          training_session_id: trainingSessionId ?? null,
        });
      })();
    },
    [lessonEnded, onLessonClosed, stopKeepAwake, releaseAllMics]
  );

  leaveBecauseEndedRef.current = leaveBecauseEnded;

  function broadcastSessionEnded(trainingSessionId?: string | null) {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    try {
      const bytes = new TextEncoder().encode(
        JSON.stringify({
          type: "session_ended",
          training_session_id: trainingSessionId ?? null,
        })
      );
      void room.localParticipant.publishData(bytes, { reliable: true });
    } catch {
      /* ignore */
    }
  }

  async function endSessionOnServer(): Promise<{
    training_session_id?: string;
    ended_by?: string;
  } | null> {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      isSolo ? 10000 : 15000
    );
    try {
      const res = await fetch(`/api/capture/sessions/${captureSessionId}/end`, {
        method: "POST",
        headers: authHeaders(),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not end lesson"
        );
      }
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  const endingInFlightRef = useRef(false);

  function handleEnd() {
    if (endingInFlightRef.current || lessonEnded) return;
    endingInFlightRef.current = true;
    intentionalEndRef.current = true;
    callDesiredRef.current = false;
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    // Stop listening + hardware immediately so the browser mic light goes off
    // before flush / navigate / debrief — not when debrief closes.
    wantListeningRef.current = false;
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }

    void (async () => {
      setFlushingEnd(true);
      setRoomError(null);

      // Tell the other phone immediately — don't wait on network flush/Claude
      broadcastSessionEnded(null);

      // Upload mic audio for Whisper before killing tracks (best-effort, capped)
      const flushMs = isSolo ? 2500 : 8000;
      try {
        await Promise.race([
          stopLessonRecorderAndFlushRef.current(),
          new Promise((r) => setTimeout(r, flushMs)),
        ]);
      } catch {
        /* ignore */
      }

      releaseAllMics();

      // Best-effort cue flush (short) — never block End on barn Wi‑Fi
      const cueMs = isSolo ? 800 : 2000;
      try {
        await Promise.race([
          outboxRef.current?.flush({ timeoutMs: cueMs }) ?? Promise.resolve(),
          new Promise((r) => setTimeout(r, cueMs)),
        ]);
      } catch {
        /* ignore */
      }

      let result: {
        training_session_id?: string | null;
        ended_by?: string;
        capture_ended?: boolean;
      } | null = null;
      try {
        result = await endSessionOnServer();
        if (result?.training_session_id) {
          broadcastSessionEnded(result.training_session_id);
        }
        // Fire-and-forget polish (Whisper + coach card) — never blocks leaving
        if (result && (result as { polish?: boolean }).polish !== false) {
          window.setTimeout(() => {
            void fetch(`/api/capture/sessions/${captureSessionId}/polish`, {
              method: "POST",
              headers: authHeaders(),
            }).catch(() => undefined);
          }, 4000);
        }
      } catch (e) {
        // Server may have closed the capture already — confirm and leave anyway
        let recovered: {
          training_session_id?: string | null;
          status?: string;
        } | null = null;
        try {
          const st = await fetch(
            `/api/capture/sessions/${captureSessionId}/status`,
            { headers: authHeaders(), cache: "no-store" }
          );
          if (st.ok) {
            recovered = (await st.json()) as {
              training_session_id?: string | null;
              status?: string;
            };
          }
        } catch {
          /* ignore */
        }
        if (
          recovered?.status === "ended" ||
          recovered?.training_session_id
        ) {
          result = {
            training_session_id: recovered.training_session_id ?? null,
            capture_ended: true,
          };
        } else {
          endingInFlightRef.current = false;
          intentionalEndRef.current = false;
          callDesiredRef.current = roomRef.current?.state === "connected";
          setFlushingEnd(false);
          const aborted =
            e instanceof DOMException && e.name === "AbortError";
          setRoomError(
            aborted
              ? "End timed out — check Wi‑Fi and tap End lesson again."
              : e instanceof Error
                ? e.message
                : "Could not end lesson — try again"
          );
          return;
        }
      } finally {
        setFlushingEnd(false);
      }

      stopKeepAwake();
      // Close bookend must never trap End — TTS/network can hang
      const bookendMs = isSolo ? 2000 : 3500;
      try {
        await Promise.race([
          playCloseBookend(),
          new Promise((r) => setTimeout(r, bookendMs)),
        ]);
      } catch {
        /* ignore */
      }
      unlockSafariScroll();
      setLessonEnded(true);
      setEndedRemote(false);

      try {
        await onEnd?.({
          training_session_id: result?.training_session_id || undefined,
          ended_by: result?.ended_by,
        });
      } catch {
        /* navigation errors */
      }
      onLessonClosed?.({
        remote: false,
        training_session_id: result?.training_session_id ?? null,
      });
    })();
  }

  // Backup: poll status so we still leave if the data-channel message was missed
  useEffect(() => {
    if (lessonEnded) return;
    const tick = async () => {
      if (intentionalEndRef.current) return;
      try {
        const res = await fetch(
          `/api/capture/sessions/${captureSessionId}/status`,
          { headers: authHeaders(), cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "ended") {
          leaveBecauseEndedRef.current(true, data.training_session_id ?? null);
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => window.clearInterval(id);
  }, [authHeaders, captureSessionId, lessonEnded]);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
  const inCall =
    roomState === "connected" ||
    roomState === "connecting" ||
    roomState === "reconnecting";

  if (lessonEnded) {
    return (
      <div className="space-y-4 rounded-xl border border-gold/20 bg-[#131C31] px-4 py-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Lesson ended
        </p>
        <p className="font-serif text-2xl text-cream">
          {endedRemote
            ? `${peerLabel} ended the lesson.`
            : "This lesson is closed for everyone."}
        </p>
        <p className="text-sm text-cream/55">
          {speaker === "rider"
            ? "Opening your debrief…"
            : "You can close this tab — thanks for coaching."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
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

      {showWakeUi ? (
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-cream-dim">
            {vectorStrip === "turn" ? "◇ VECTOR" : '◇ SAY "HEY VECTOR"'}
          </p>
          {speaker === "trainer" || isSolo ? (
            <button
              type="button"
              onClick={() => toggleVectorCalledOn()}
              className="text-[10px] uppercase tracking-[0.22em] text-gold"
            >
              VECTOR · {vectorCalledOn ? "ON" : "OFF"}
            </button>
          ) : null}
        </div>
      ) : null}

      {bookendLine ? (
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold">
            Vector
          </p>
          <p className="mt-1 font-serif text-lg text-cream">{bookendLine}</p>
          <p className="mt-2 text-[11px] text-cream/45">
            {isSolo
              ? "Spoken on this phone."
              : "On the call — both phones hear it through the headset mix."}
          </p>
        </div>
      ) : null}

      {showWakeUi ? (
        <p className="px-1 text-[11px] text-cream/40">
          {vectorStrip === "turn"
            ? "Listening — ask in one breath, then pause."
            : "Armed while you ride — say Hey Vector, then the question in one breath."}
        </p>
      ) : null}

      {(networkOffline || pendingQueue > 0 || weakLink || screenHint || roomError) && (
        <div className="rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-cream/80 space-y-2">
          {networkOffline ? (
            <p>Offline — cues stay on this phone and will sync when Wi‑Fi returns.</p>
          ) : pendingQueue > 0 ? (
            <p>
              Syncing timeline ({pendingQueue} cue
              {pendingQueue === 1 ? "" : "s"} queued)…
            </p>
          ) : null}
          {weakLink && !networkOffline && (
            <p>
              Weak link — still in lesson. Move closer to the barn Wi‑Fi or keep
              this screen on.
            </p>
          )}
          {screenHint && (
            <div className="space-y-1">
              <p className="text-gold/90">
                Tip: Settings → Display → Auto-Lock → Never while riding, so
                Safari does not suspend the tab. Leave this message up while you
                change the setting.
              </p>
              <button
                type="button"
                className="text-[11px] uppercase tracking-wider text-cream/50 underline"
                onClick={() => setScreenHint(false)}
              >
                Got it
              </button>
            </div>
          )}
          {roomError && roomState !== "idle" && (
            <p className="text-destructive">{roomError}</p>
          )}
        </div>
      )}

      {joinCode && joinUrl && !isSolo && (showConnectHelp || !peerConnected) ? (
        <div className="rounded-xl border border-gold/20 bg-[#131C31] p-4 space-y-3 text-center">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cream/40">
              Trainer join code
            </p>
            {peerConnected ? (
              <button
                type="button"
                onClick={() => setShowConnectHelp(false)}
                className="text-[10px] uppercase tracking-[0.2em] text-cream/45 hover:text-gold"
              >
                Hide
              </button>
            ) : null}
          </div>
          <p className="font-serif text-3xl tracking-[0.2em] text-gold">
            {joinCode}
          </p>
          <JoinQr url={joinUrl} />
          <p className="break-all text-xs text-cream/45">{joinUrl}</p>
          <p className="text-xs text-cream/50">
            Trainer opens the link on their phone — headset call, no account.
            Capture starts when both of you are on the call.
          </p>
        </div>
      ) : joinCode && joinUrl && !isSolo && peerConnected ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowConnectHelp(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 text-[15px] font-serif text-gold hover:border-gold/50 hover:text-gold-bright"
            aria-label="How to reconnect trainer"
            title="How to reconnect trainer"
          >
            ?
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-gold/15 bg-[#131C31] px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cream/40">
            {isSolo ? "Solo ride" : "Headset call"}
          </p>
          {!isSolo && roomState === "connected" && !showConnectHelp ? (
            <button
              type="button"
              onClick={() => setShowConnectHelp(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/20 text-[13px] font-serif text-gold hover:border-gold/45"
              aria-label="Call setup help"
            >
              ?
            </button>
          ) : null}
        </div>

        {isSolo ? (
          <div className="space-y-2">
            <p className="text-sm text-cream/90">
              {captureLive
                ? asrArmed
                  ? "Mic live — say Hey Vector when you want input."
                  : "Vector speaking…"
                : roomError
                  ? "Need the mic to capture."
                  : autoStart || seedMicStream
                    ? "Opening mic… tap below if this hangs."
                    : "Allow the microphone above to start capture."}
            </p>
            <VoiceLevelMeter track={meterTrack} muted={muted} />
            {roomError ? (
              <p className="text-xs text-destructive">{roomError}</p>
            ) : null}
            {!captureLive ? (
              <button
                type="button"
                onClick={() => void openSoloMicFromTap()}
                className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-navy hover:bg-gold-bright"
              >
                {roomError ? "Try mic again" : "Open mic — start capture"}
              </button>
            ) : null}
            <p className="text-xs text-cream/45">
              Your transcript:{" "}
              {!captureLive
                ? autoStart || seedMicStream
                  ? "starting…"
                  : "waiting for mic"
                : !asrArmed
                  ? "waiting for Vector…"
                  : speechUnsupported
                  ? "browser speech unavailable — recording for Whisper"
                  : listening && interim
                    ? "dictating…"
                    : listening && !asrGotSpeech
                    ? "listening — speak and words appear as you go"
                    : listening
                      ? "listening…"
                      : "paused — will resume when this screen is open"}
            </p>
          </div>
        ) : !livekitProp.configured && roomState === "idle" ? (
          <p className="text-sm text-cream/70">
            Add LiveKit env vars and redeploy to enable the call.
          </p>
        ) : roomState === "idle" || roomState === "error" ? (
          <div className="space-y-2">
            {showConnectHelp ? (
              <p className="text-sm text-cream/80">
                Start once — Vector keeps the lesson open and reconnects if the
                phone sleeps or barn Wi‑Fi dips. For the most reliable ride, leave
                this screen on (Auto-Lock: Never) with the phone mounted. Cues
                queue on-device if the network drops, then sync when it returns.
              </p>
            ) : null}
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
              {isSolo
                ? captureLive
                  ? "On call — capturing solo"
                  : "On call — starting capture…"
                : peerConnected
                  ? captureLive
                    ? `On call with ${peerLabel}`
                    : `On call with ${peerLabel} — starting capture…`
                  : `In call — waiting for ${peerLabel}…`}
            </p>
            {!isSolo && !peerConnected ? (
              <p className="text-xs text-cream/50">
                Timeline and recording stay off until {peerLabel} joins.
              </p>
            ) : null}
            {isSolo && captureLive ? (
              <p className="text-xs text-cream/50">
                Say Hey Vector when you want input — no second phone needed.
              </p>
            ) : null}
            {showConnectHelp ? (
              <p className="text-xs text-cream/45">
                Tip: Settings → Display → Auto-Lock → Never while riding, so
                Safari does not suspend the tab.
                <button
                  type="button"
                  className="ml-2 uppercase tracking-wider text-gold underline"
                  onClick={() => setShowConnectHelp(false)}
                >
                  Hide
                </button>
              </p>
            ) : null}

            <VoiceLevelMeter track={meterTrack} muted={muted} />

            <p className="text-xs text-cream/45">
              Your transcript:{" "}
              {!captureLive
                ? isSolo
                  ? "starting…"
                  : `waiting for ${peerLabel}`
                : speechUnsupported
                  ? "speech not available in this browser — try Safari/Chrome with mic allowed"
                  : listening
                    ? "listening…"
                    : "paused — will resume when this screen is open"}
            </p>
            {captureLive && !isSolo ? (
              <p className="text-xs text-cream/40">
                Timeline syncs both sides — you should see {peerLabel}&apos;s cues
                here too. On weak barn Wi‑Fi the call may dip; your cues still
                queue locally until they sync.
              </p>
            ) : null}
            {screenHint && (
              <p className="text-xs text-gold/80">
                Tip: Settings → Display → Auto-Lock → Never while riding — this
                tip stays until you dismiss it above.
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
          Conversation timeline
        </p>
        {segments.length === 0 && !interim && !peerInterim && (
          <p className="text-sm text-cream/40">
            {!captureLive
              ? isSolo
                ? autoStart || seedMicStream
                  ? "Opening capture…"
                  : "Allow the microphone above — then your speech appears here."
                : `Waiting for ${peerLabel} — capture starts when both of you are on the call.`
              : isSolo
                ? "Speak — words show here as you go, then settle."
                : "Rider and trainer speech will appear here with timestamps."}
          </p>
        )}
        {segments.map((s, i) => {
          const mine = s.speaker === speaker;
          const label =
            s.speaker === "system"
              ? "system"
              : s.speaker === "vector"
                ? "Vector"
                : mine
                  ? "you"
                  : s.speaker === "trainer"
                    ? peerLabel
                    : s.speaker === "rider"
                      ? "rider"
                      : peerLabel;
          return (
            <div key={s.id || `${s.speaker}-${s.offset_ms}-${i}`} className="text-sm">
              <span className="tabular-nums text-gold/80">
                {formatOffset(s.offset_ms)}
              </span>{" "}
              <span
                className={
                  s.speaker === "vector" || !mine
                    ? "text-[10px] uppercase tracking-wider text-gold"
                    : "text-[10px] uppercase tracking-wider text-cream/40"
                }
              >
                {label}
              </span>
              <p className="text-cream/90">{s.text}</p>
            </div>
          );
        })}
        {interim ? (
          <div className="border-t border-[rgba(209,169,85,0.18)] pt-2">
            <span className="text-[10px] uppercase tracking-wider text-cream/40">
              you
            </span>
            <p className="text-[15px] leading-relaxed text-cream/75 italic">
              {interim}
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-pulse bg-gold align-text-bottom"
              />
            </p>
          </div>
        ) : null}
        {peerInterim ? (
          <p className="text-sm italic text-gold/70">
            {peerLabel}: {peerInterim}
          </p>
        ) : null}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-gold/20 bg-navy/95 px-4 pt-3 backdrop-blur-md"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          type="button"
          onClick={handleEnd}
          disabled={ending || flushingEnd}
          className="w-full rounded-lg bg-gold px-4 py-3.5 text-sm font-semibold text-navy hover:bg-gold-bright disabled:opacity-50"
        >
          {flushingEnd
            ? "Ending lesson…"
            : ending
              ? "Opening debrief…"
              : "End lesson"}
        </button>
        <p className="mt-2 text-center text-[10px] text-cream/40">
          {isSolo
            ? "Ends capture for this solo ride"
            : `Ends the lesson for you and ${peerLabel}`}
        </p>
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
