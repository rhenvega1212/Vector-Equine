import { unlockVectorAudio } from "@/lib/capture/play-vector-audio";

/** Soft earcon after wake — under 200ms, a note, not a word. Brief 14 §5. */

let earconCtx: AudioContext | null = null;

function ctx(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!earconCtx) earconCtx = new AC();
  return earconCtx;
}

/** One note of the chime. */
function note(
  audio: AudioContext,
  at: number,
  hz: number,
  peak: number,
  hold: number
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(hz, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + hold);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(at);
  osc.stop(at + hold + 0.02);
}

/** Rising two-tone — "I'm listening". */
export async function playWakeEarcon(): Promise<void> {
  try {
    await unlockVectorAudio();
    const audio = ctx();
    if (audio.state === "suspended") await audio.resume();
    const now = audio.currentTime;
    note(audio, now, 784, 0.16, 0.11); // G5
    note(audio, now + 0.085, 1175, 0.2, 0.2); // D6
  } catch {
    /* ignore — false wake cost stays zero either way */
  }
}

/** Falling two-tone — the turn is closed, mic is still recording the ride. */
export async function playCloseEarcon(): Promise<void> {
  try {
    await unlockVectorAudio();
    const audio = ctx();
    if (audio.state === "suspended") await audio.resume();
    const now = audio.currentTime;
    note(audio, now, 1175, 0.12, 0.1); // D6
    note(audio, now + 0.085, 784, 0.14, 0.18); // G5
  } catch {
    /* ignore */
  }
}
