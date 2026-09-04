import {
  LocalAudioTrack,
  Track,
  type Room,
} from "livekit-client";

/** Shared AudioContext — LiveKit publish + Web Audio fallback. */
let vectorAudioCtx: AudioContext | null = null;

/**
 * Keep the iOS audio session alive. Solo never joins LiveKit, so without this
 * the mute switch / a suspended context swallows Vector and can hang playback
 * (onended never fires → ASR never restarts → Hey Vector dies).
 */
let holdEl: HTMLAudioElement | null = null;
/** Reused for every mp3 — iOS often blocks a fresh Audio() after the gesture. */
let speechEl: HTMLAudioElement | null = null;
let speechObjectUrl: string | null = null;
/** Barge-in / stop — don't start a fallback voice after the rider cuts in. */
let playbackCancelled = false;

type ActivePlayback = {
  stop: () => void;
  resolve: (spoken: boolean) => void;
};

let activePlayback: ActivePlayback | null = null;

/** Browser speechSynthesis fallback when ElevenLabs audio is unavailable. */
let browserSpeechActive = false;
let browserSpeechTimer: number | null = null;

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

function primeMediaEl(el: HTMLAudioElement) {
  el.setAttribute("playsinline", "true");
  el.preload = "auto";
}

function ensureHoldEl(): HTMLAudioElement {
  if (!holdEl) {
    holdEl = new Audio("/silence.wav");
    primeMediaEl(holdEl);
    holdEl.loop = true;
    holdEl.volume = 0.01;
  }
  return holdEl;
}

function ensureSpeechEl(): HTMLAudioElement {
  if (!speechEl) {
    speechEl = new Audio();
    primeMediaEl(speechEl);
  }
  return speechEl;
}

function clearSpeechSrc() {
  if (speechObjectUrl) {
    try {
      URL.revokeObjectURL(speechObjectUrl);
    } catch {
      /* ignore */
    }
    speechObjectUrl = null;
  }
  if (speechEl) {
    try {
      speechEl.pause();
      speechEl.removeAttribute("src");
      speechEl.load();
    } catch {
      /* ignore */
    }
  }
}

/** Unlock autoplay + AudioContext on iOS/Safari — call once from a user gesture. */
export async function unlockVectorAudio(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const ctx = getVectorAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const hold = ensureHoldEl();
    ensureSpeechEl();
    if (hold.paused) {
      await hold.play();
    }
  } catch {
    /* gesture may still unlock later on first real play */
  }
}

export function isVectorPlaying(): boolean {
  return activePlayback != null || browserSpeechActive;
}

function haltPlayback(): void {
  if (browserSpeechActive) {
    browserSpeechActive = false;
    if (browserSpeechTimer != null) {
      window.clearTimeout(browserSpeechTimer);
      browserSpeechTimer = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }
  const cur = activePlayback;
  if (!cur) return;
  activePlayback = null;
  try {
    cur.stop();
  } catch {
    /* ignore */
  }
}

/**
 * Local speak when cloud TTS fails or returns no audio.
 * Uses the system voice so lab / solo still hears the open line.
 */
export async function speakTextLocally(text: string): Promise<boolean> {
  if (typeof window === "undefined" || !text.trim()) return false;
  const synth = window.speechSynthesis;
  if (!synth) return false;

  await unlockVectorAudio();
  haltPlayback();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      browserSpeechActive = false;
      if (browserSpeechTimer != null) {
        window.clearTimeout(browserSpeechTimer);
        browserSpeechTimer = null;
      }
      resolve(ok);
    };

    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text.trim());
      utter.rate = 1.02;
      utter.pitch = 1;
      browserSpeechActive = true;
      utter.onend = () => finish(true);
      utter.onerror = () => finish(false);
      synth.speak(utter);
      // Some embedded browsers never fire onend
      browserSpeechTimer = window.setTimeout(
        () => finish(true),
        Math.min(22_000, 900 + text.trim().length * 70)
      );
    } catch {
      finish(false);
    }
  });
}

/** Channel rule / stop phrase — halt TTS, keep text on screen. */
export function stopVectorPlayback(): void {
  playbackCancelled = true;
  haltPlayback();
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

function estimateMp3DurationMs(byteLength: number): number {
  // 22.05 kHz / 32 kbps mp3 ≈ 4 bytes per ms; pad for headers + iOS lag
  return Math.min(28_000, Math.max(1800, byteLength / 4 + 800));
}

/** Play ElevenLabs mp3 on the unlocked HTMLAudioElement (iOS-reliable). */
function playMp3OnElement(buf: ArrayBuffer): Promise<boolean> {
  return new Promise((resolve) => {
    const el = ensureSpeechEl();
    clearSpeechSrc();
    const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
    speechObjectUrl = url;
    el.loop = false;
    el.volume = 1;
    el.src = url;

    let settled = false;
    let timer: number | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timer != null) window.clearTimeout(timer);
      el.onended = null;
      el.onerror = null;
      if (activePlayback?.resolve === resolve) {
        activePlayback = null;
      }
      clearSpeechSrc();
      resolve(ok);
    };

    timer = window.setTimeout(
      () => finish(true),
      estimateMp3DurationMs(buf.byteLength)
    );
    el.onended = () => finish(true);
    el.onerror = () => finish(false);

    const stop = () => {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
      finish(false);
    };

    activePlayback = { stop, resolve };
    void el.play().then(
      () => {
        if (settled) return;
        const dur = el.duration;
        if (Number.isFinite(dur) && dur > 0) {
          if (timer != null) window.clearTimeout(timer);
          timer = window.setTimeout(() => finish(true), dur * 1000 + 700);
        }
      },
      () => finish(false)
    );
  });
}

/** Last-resort: Web Audio destination if the HTML element cannot start. */
async function playViaWebAudio(buf: ArrayBuffer): Promise<boolean> {
  const ctx = getVectorAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (activePlayback?.resolve === resolve) activePlayback = null;
      try {
        source.stop();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const timer = window.setTimeout(
      () => finish(true),
      audioBuffer.duration * 1000 + 700
    );
    source.onended = () => {
      window.clearTimeout(timer);
      finish(true);
    };
    activePlayback = {
      stop: () => {
        window.clearTimeout(timer);
        finish(false);
      },
      resolve,
    };
    try {
      source.start(0);
    } catch {
      window.clearTimeout(timer);
      finish(false);
    }
  });
}

async function publishIntoCall(
  room: Room,
  buf: ArrayBuffer
): Promise<{
  published: LocalAudioTrack | null;
  mediaTrack: MediaStreamTrack | null;
  source: AudioBufferSourceNode | null;
}> {
  const ctx = getVectorAudioContext();
  if (ctx.state === "suspended") await ctx.resume();
  const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);
  const mediaTrack = dest.stream.getAudioTracks()[0] || null;
  if (!mediaTrack) {
    return { published: null, mediaTrack: null, source };
  }
  const published = new LocalAudioTrack(mediaTrack, undefined, true, ctx);
  await room.localParticipant.publishTrack(published, {
    name: "vector",
    source: Track.Source.Unknown,
  });
  try {
    source.start(0);
  } catch {
    /* local HTML audio still plays */
  }
  return { published, mediaTrack, source };
}

/**
 * Speak ElevenLabs mp3 on this phone. Trainer sessions also publish into
 * the LiveKit mix so the other headset hears it.
 */
export async function playDecodedIntoCall(
  room: Room | null,
  buf: ArrayBuffer
): Promise<boolean> {
  if (!buf.byteLength) return false;
  haltPlayback();
  await unlockVectorAudio();
  playbackCancelled = false;

  let published: LocalAudioTrack | null = null;
  let mediaTrack: MediaStreamTrack | null = null;
  let mixSource: AudioBufferSourceNode | null = null;
  const canPublish = Boolean(
    room && room.state === "connected" && room.localParticipant
  );

  if (room && canPublish) {
    try {
      const mix = await publishIntoCall(room, buf);
      published = mix.published;
      mediaTrack = mix.mediaTrack;
      mixSource = mix.source;
    } catch {
      /* local play still matters */
    }
  }

  let spoken = await playMp3OnElement(buf);
  if (!spoken && !playbackCancelled) {
    try {
      spoken = await playViaWebAudio(buf);
    } catch {
      spoken = false;
    }
  }

  try {
    mixSource?.stop();
  } catch {
    /* ignore */
  }
  await cleanupPublished(room, published, mediaTrack);
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
      const spoken = await speakTextLocally(text);
      return { text, spoken };
    }

    const ct = res.headers.get("Content-Type") || "";
    if (!ct.includes("audio")) {
      const json = await res.json().catch(() => ({}));
      text = (json as { text?: string }).text || text;
      const spoken = await speakTextLocally(text);
      return { text, spoken };
    }

    const buf = await res.arrayBuffer();
    if (!buf.byteLength) {
      const spoken = await speakTextLocally(text);
      return { text, spoken };
    }

    let spoken = await playDecodedIntoCall(room, buf);
    if (!spoken && !playbackCancelled) {
      spoken = await speakTextLocally(text);
    }
    return { text, spoken };
  } catch {
    const spoken = await speakTextLocally(fallbackText);
    return { text: fallbackText, spoken };
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

/** POST called-turn generation; always speak the reply when we have text. */
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
    priorTurns?: Array<{ question: string; answer: string }>;
  },
  authHeaders: () => HeadersInit
): Promise<CalledTurnClientResult> {
  try {
    await unlockVectorAudio();
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
    const kind = res.headers.get("X-Vector-Kind") || undefined;
    const grounding = res.headers.get("X-Vector-Grounding") || undefined;

    if (ct.includes("audio")) {
      const text = headerText
        ? decodeURIComponent(headerText)
        : "Vector answered — check the strip.";
      const buf = await res.arrayBuffer();
      let spoken = false;
      if (buf.byteLength) {
        spoken = await playDecodedIntoCall(room, buf);
      }
      if (!spoken && text.trim() && !playbackCancelled) {
        spoken = await speakTextLocally(text);
      }
      if (!spoken && text.trim() && !playbackCancelled) {
        const again = await speakVectorIntoCall(
          room,
          captureSessionId,
          {
            kind: "turn",
            text,
            offsetMs: body.offsetMs,
            persist: false,
          },
          authHeaders
        );
        spoken = again.spoken;
      }
      return {
        text,
        spoken,
        silent: false,
        intent: "ask",
        kind,
        grounding,
        crossingSaid: crossing,
      };
    }

    const json = (await res.json().catch(() => ({}))) as {
      silent?: boolean;
      intent?: "ask" | "stop" | "replay";
      text?: string;
      failure?: boolean;
      speak?: boolean;
      offer?: { kind?: string; grounding?: string };
    };

    if (json.silent) {
      return { text: "", spoken: false, silent: true, intent: "ask" };
    }

    const text = (json.text || "").trim();
    if (!text) {
      return {
        text: "",
        spoken: false,
        silent: true,
        intent: json.intent || "ask",
        failure: json.failure,
      };
    }

    // JSON path (TTS failed server-side) — still speak on device
    let spoken = await speakTextLocally(text);
    if (!spoken && !playbackCancelled) {
      const again = await speakVectorIntoCall(
        room,
        captureSessionId,
        {
          kind: "turn",
          text,
          offsetMs: body.offsetMs,
          persist: false,
        },
        authHeaders
      );
      spoken = again.spoken;
    }

    return {
      text,
      spoken,
      silent: false,
      intent: json.intent || "ask",
      failure: json.failure,
      kind: json.offer?.kind || kind,
      grounding: json.offer?.grounding || grounding,
      crossingSaid: crossing,
    };
  } catch {
    const fallback = "Couldn't get that — try again in a moment.";
    const spoken = await speakTextLocally(fallback);
    return {
      text: fallback,
      spoken,
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
