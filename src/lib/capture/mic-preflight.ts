/**
 * Early microphone grant for Capture Live (iOS requires a user gesture).
 * Persist success so we can show sticky help until allowed.
 */

const STORAGE_KEY = "vector-mic-granted";

export function isMicGrantedStored(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markMicGranted() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearMicGranted() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type MicPreflightResult =
  | { ok: true }
  | { ok: false; blocked: boolean; message: string };

export const MIC_BLOCKED_HELP =
  "Microphone is blocked. On iPhone: Settings → Apps → Safari → Microphone → Allow, then return here and tap Allow microphone again. On other phones: check the site permission lock icon in the address bar.";

export async function requestMicAccess(): Promise<MicPreflightResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      blocked: true,
      message: "This browser cannot access the microphone. Try Safari or Chrome.",
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    markMicGranted();
    return { ok: true };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    const msg = e instanceof Error ? e.message : String(e);
    const blocked =
      name === "NotAllowedError" ||
      name === "PermissionDeniedError" ||
      /not allowed|permission/i.test(msg);
    return {
      ok: false,
      blocked,
      message: blocked
        ? MIC_BLOCKED_HELP
        : name === "NotFoundError"
          ? "No microphone found. Plug in headphones with a mic and try again."
          : msg || "Could not access the microphone.",
    };
  }
}
