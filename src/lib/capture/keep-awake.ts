/**
 * Keep the phone awake during a Capture Live call.
 * Screen Wake Lock + looping canvas stream + MediaSession.
 *
 * Best effort on iOS Safari. Wake Lock prevents auto-lock while Vector is
 * open (phone on mount). Fully locked Safari tabs can still suspend — we
 * auto-reconnect without ending the lesson when that happens.
 */

export type KeepAwakeHandle = {
  start: () => Promise<void>;
  stop: () => void;
};

export function createKeepAwake(): KeepAwakeHandle {
  let wakeLock: WakeLockSentinel | null = null;
  let video: HTMLVideoElement | null = null;
  let frameTimer: number | null = null;
  let stopped = false;
  let flip = false;

  async function requestWake() {
    try {
      if (!("wakeLock" in navigator)) return;
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        if (!stopped && document.visibilityState === "visible") {
          void requestWake();
        }
      });
    } catch {
      /* denied / unsupported */
    }
  }

  function ensureCanvasStream() {
    if (video?.srcObject) return video;

    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");

    const paint = () => {
      if (!ctx) return;
      flip = !flip;
      ctx.fillStyle = flip ? "#0E1729" : "#0F182A";
      ctx.fillRect(0, 0, 2, 2);
    };
    paint();

    const el = document.createElement("video");
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.muted = true;
    el.playsInline = true;
    el.loop = true;
    el.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0;z-index:-1;";
    el.srcObject = canvas.captureStream(1);
    document.body.appendChild(el);
    video = el;

    frameTimer = window.setInterval(paint, 1000);
    return el;
  }

  async function start() {
    stopped = false;
    await requestWake();

    try {
      const el = ensureCanvasStream();
      await el.play();
    } catch {
      /* needs user gesture — Start call provides it */
    }

    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Vector lesson — keep screen on",
          artist: "Vector Equine",
          album: "Capture Live",
        });
        navigator.mediaSession.playbackState = "playing";
      }
    } catch {
      /* ignore */
    }
  }

  function stop() {
    stopped = true;
    if (frameTimer != null) {
      window.clearInterval(frameTimer);
      frameTimer = null;
    }
    try {
      wakeLock?.release();
    } catch {
      /* ignore */
    }
    wakeLock = null;

    if (video) {
      try {
        video.pause();
        const stream = video.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
        video.remove();
      } catch {
        /* ignore */
      }
      video = null;
    }

    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      }
    } catch {
      /* ignore */
    }
  }

  return { start, stop };
}
