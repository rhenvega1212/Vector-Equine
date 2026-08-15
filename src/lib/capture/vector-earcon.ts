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

export async function playWakeEarcon(): Promise<void> {
  try {
    const audio = ctx();
    if (audio.state === "suspended") await audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    /* ignore — false wake cost stays zero either way */
  }
}
