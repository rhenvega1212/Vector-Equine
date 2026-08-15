import {
  LocalAudioTrack,
  Track,
  type Room,
} from "livekit-client";

/** Shared AudioContext — must resume from a user gesture (Start / Join). */
let vectorAudioCtx: AudioContext | null = null;
let audioUnlocked = false;

/** Active Vector playback — barge-in / stop phrase. */
let activePlayback: {
  source: AudioBufferSourceNode;
  published: LocalAudioTrack | null;
  room: Room | null;
  mediaTrack: MediaStreamTrack | null;
  resolve: (spoken: boolean) => void;
} | null = null;

function getVectorAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("AudioContext is browser-only");
  }
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!vectorAudioCtx) {
    vectorAudioCtx = new AC();
  }
  return vectorAudioCtx;
}

/** Unlock autoplay + AudioContext on iOS/Safari — call once from a user gesture. */
export async function unlockVectorAudio(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const ctx = getVectorAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    if (!audioUnlocked) {
      const a = new Audio();
      a.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      a.volume = 0.01;
      await a.play();
      a.pause();
      audioUnlocked = true;
    }
  } catch {
    /* gesture may still unlock later on first real play */
  }
}

export function isVectorPlaying(): boolean {
  return activePlayback != null;
}

/** Channel rule / stop phrase — halt TTS, keep text on screen. */
export function stopVectorPlayback(): void {
  const cur = activePlayback;
  if (!cur) return;
  activePlayback = null;
  try {
    cur.source.stop();
  } catch {
    /* ignore */
  }
  void cleanupPublished(cur.room, cur.published, cur.mediaTrack);
  cur.resolve(false);
}

async function cleanupPublished(
  room: Room | null,
  published: LocalAudioTrack | null,
  mediaTrack: MediaStreamTrack | null
) {
  if (published && room) {
    try {
      await room.localParticipant.unpublishTrack(published);
    } catch {
      /* ignore */
    }
    try {
      published.stop();
    } catch {
      /* ignore */
    }
  } else if (mediaTrack) {
    try {
      mediaTrack.stop();
    } catch {
      /* ignore */
    }
  }
}

/** Publish decoded mp3/wav bytes into the LiveKit shared mix + local monitor. */
export async function playDecodedIntoCall(
  room: Room | null,
  buf: ArrayBuffer
): Promise<boolean> {
  stopVectorPlayback();
  await unlockVectorAudio();

  const ctx = getVectorAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const monitor = ctx.createGain();
  monitor.gain.value = 1;
  source.connect(monitor);
  monitor.connect(ctx.destination);

  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);

  const mediaTrack = dest.stream.getAudioTracks()[0];
  if (!mediaTrack) return false;

  let published: LocalAudioTrack | null = null;
  const canPublish =
    room && room.state === "connected" && room.localParticipant;

  if (canPublish) {
    published = new LocalAudioTrack(mediaTrack, undefined, true, ctx);
    await room!.localParticipant.publishTrack(published, {
      name: "vector",
      source: Track.Source.Unknown,
    });
  }

  const spoken = await new Promise<boolean>((resolve) => {
    activePlayback = {
      source,
      published,
      room,
      mediaTrack,
      resolve,
    };
    source.onended = () => {
      if (activePlayback?.source === source) {
        activePlayback = null;
        void cleanupPublished(room, published, mediaTrack);
        resolve(true);
      }
    };
    try {
      source.start(0);
    } catch {
      activePlayback = null;
      void cleanupPublished(room, published, mediaTrack);
      resolve(false);
    }
  });

  return spoken;
}

export type VectorSpeakBody = {
  kind: "open" | "close" | "turn";
  riderFirst?: string | null;
  trainerFirst?: string | null;
  offsetMs?: number;
  /** Peer replay of text only — do not synthesize again. */
  persist?: boolean;
  /** Required when kind === "turn" (replay / screen-only speak). */
  text?: string;
};

/**
 * Fetch ElevenLabs audio and speak it into the LiveKit shared mix.
 * One side publishes; the peer hears it as a remote audio track on the call.
 */
export async function speakVectorIntoCall(
  room: Room | null,
  captureSessionId: string,
  body: VectorSpeakBody,
  authHeaders: () => HeadersInit
): Promise<{ text: string; spoken: boolean }> {
  const fallbackText =
    body.kind === "close"
      ? "That's it — capture's off."
      : body.kind === "turn"
        ? body.text || ""
        : "Vector Equine. Capturing from here.";

  try {
    await unlockVectorAudio();

    const res = await fetch(
      `/api/capture/sessions/${captureSessionId}/vector/speak`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
        credentials: "include",
      }
    );

    const headerText = res.headers.get("X-Vector-Text");
    let text = headerText ? decodeURIComponent(headerText) : fallbackText;

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      text =
        typeof (json as { text?: string }).text === "string"
          ? (json as { text: string }).text
          : fallbackText;
      return { text, spoken: false };
    }

    const ct = res.headers.get("Content-Type") || "";
    if (!ct.includes("audio")) {
      const json = await res.json().catch(() => ({}));
      return {
        text: (json as { text?: string }).text || text,
        spoken: false,
      };
    }

    const buf = await res.arrayBuffer();
    if (!buf.byteLength) {
      return { text, spoken: false };
    }

    const spoken = await playDecodedIntoCall(room, buf);
    return { text, spoken };
  } catch {
    return { text: fallbackText, spoken: false };
  }
}

export type CalledTurnClientResult = {
  text: string;
  spoken: boolean;
  silent: boolean;
  intent: "ask" | "stop" | "replay";
  kind?: string;
  grounding?: string;
  crossingSaid?: boolean;
  failure?: boolean;
};

/** POST called-turn generation; speak into call when audio returns fast enough. */
export async function runCalledTurnIntoCall(
  room: Room | null,
  captureSessionId: string,
  body: {
    question: string;
    askedBy: "rider" | "trainer";
    offsetMs?: number;
    riderFirst?: string | null;
    trainerFirst?: string | null;
    crossingLineAlreadySaid?: boolean;
    declinedTexts?: string[];
    intent?: "ask" | "stop" | "replay";
  },
  authHeaders: () => HeadersInit
): Promise<CalledTurnClientResult> {
  try {
    await unlockVectorAudio();
    const started = Date.now();
    const res = await fetch(
      `/api/capture/sessions/${captureSessionId}/vector/turn`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
        credentials: "include",
      }
    );

    if (!res.ok) {
      return {
        text: "",
        spoken: false,
        silent: true,
        intent: "ask",
      };
    }

    const ct = res.headers.get("Content-Type") || "";
    const headerText = res.headers.get("X-Vector-Text");
    const crossing = res.headers.get("X-Vector-Crossing") === "1";

    if (ct.includes("audio") && headerText) {
      const text = decodeURIComponent(headerText);
      const elapsed = Date.now() - started;
      if (elapsed >= 4000) {
        return {
          text,
          spoken: false,
          silent: false,
          intent: "ask",
          kind: res.headers.get("X-Vector-Kind") || undefined,
          grounding: res.headers.get("X-Vector-Grounding") || undefined,
          crossingSaid: crossing,
        };
      }
      const buf = await res.arrayBuffer();
      const spoken =
        elapsed < 2500 && buf.byteLength
          ? await playDecodedIntoCall(room, buf)
          : false;
      return {
        text,
        spoken,
        silent: false,
        intent: "ask",
        kind: res.headers.get("X-Vector-Kind") || undefined,
        grounding: res.headers.get("X-Vector-Grounding") || undefined,
        crossingSaid: crossing,
      };
    }

    const json = (await res.json().catch(() => ({}))) as {
      silent?: boolean;
      intent?: "ask" | "stop" | "replay";
      text?: string;
      failure?: boolean;
    };

    if (json.silent) {
      return { text: "", spoken: false, silent: true, intent: "ask" };
    }

    return {
      text: json.text || "",
      spoken: false,
      silent: false,
      intent: json.intent || "ask",
      failure: json.failure,
      crossingSaid: crossing,
    };
  } catch {
    return {
      text: "Couldn't get that — try again in a moment.",
      spoken: false,
      silent: false,
      intent: "ask",
      failure: true,
    };
  }
}

/** @deprecated Use speakVectorIntoCall — kept name alias during migrate */
export async function playVectorAudio(
  captureSessionId: string,
  body: VectorSpeakBody,
  authHeaders: () => HeadersInit,
  room?: Room | null
): Promise<{ text: string; played: boolean }> {
  const result = await speakVectorIntoCall(
    room ?? null,
    captureSessionId,
    body,
    authHeaders
  );
  return { text: result.text, played: result.spoken };
}
