/**
 * Client-side called-turn state machine (Brief 14 Phase 5 + reply window).
 * Driven by local ASR finals/interims after wake arms.
 */

import { playWakeEarcon } from "@/lib/capture/vector-earcon";
import {
  isVectorPlaying,
  runCalledTurnIntoCall,
  speakVectorIntoCall,
  stopVectorPlayback,
} from "@/lib/capture/play-vector-audio";
import {
  classifyTurnIntent,
  isAddressedToVector,
  isIntelligibleQuestion,
  isStopPhrase,
  splitWakeUtterance,
} from "@/lib/capture/wake-word";
import type { Room } from "livekit-client";

const SILENCE_MS = 1200;
const CAP_MS = 12_000;
const FOLLOW_UP_MS = 8000;
const COOLDOWN_MS = 900;

export type CalledTurnUi = {
  strip: "idle" | "turn";
  line: string | null;
};

export type CalledTurnRuntimeOpts = {
  getRoom: () => Room | null;
  getCaptureSessionId: () => string;
  getAuthHeaders: () => HeadersInit;
  getAskedBy: () => "rider" | "trainer";
  getRiderFirst: () => string | null;
  getTrainerFirst: () => string | null;
  getOffsetMs: () => number;
  isArmed: () => boolean;
  isCaptureLive: () => boolean;
  onUi: (ui: Partial<CalledTurnUi>) => void;
  broadcast: (msg: Record<string, unknown>) => void;
};

export function createCalledTurnRuntime(opts: CalledTurnRuntimeOpts) {
  let collecting = false;
  let buffer = "";
  let silenceTimer: number | null = null;
  let capTimer: number | null = null;
  let followUpUntil = 0;
  let crossingSaid = false;
  let lastExerciseText: string | null = null;
  let declined: string[] = [];
  let busy = false;
  let cooldownUntil = 0;
  let disposed = false;

  function clearCollectTimers() {
    if (silenceTimer != null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (capTimer != null) {
      window.clearTimeout(capTimer);
      capTimer = null;
    }
  }

  function resetCollect() {
    collecting = false;
    buffer = "";
    clearCollectTimers();
  }

  function setIdleStrip() {
    opts.onUi({ strip: "idle" });
  }

  function openFollowUp() {
    followUpUntil = Date.now() + FOLLOW_UP_MS;
  }

  function broadcastTurn(text: string) {
    opts.broadcast({
      type: "vector_turn",
      text,
      asker: opts.getAskedBy(),
    });
  }

  async function handleStop() {
    stopVectorPlayback();
    opts.broadcast({ type: "vector_stop" });
    resetCollect();
    setIdleStrip();
    busy = false;
  }

  async function handleReplay() {
    if (!lastExerciseText) {
      resetCollect();
      setIdleStrip();
      return;
    }
    busy = true;
    opts.onUi({ strip: "turn", line: lastExerciseText });
    broadcastTurn(lastExerciseText);
    try {
      await speakVectorIntoCall(
        opts.getRoom(),
        opts.getCaptureSessionId(),
        {
          kind: "turn",
          text: lastExerciseText,
          offsetMs: opts.getOffsetMs(),
          persist: false,
        },
        opts.getAuthHeaders
      );
    } finally {
      busy = false;
      openFollowUp();
      cooldownUntil = Date.now() + COOLDOWN_MS;
      window.setTimeout(() => {
        if (!isVectorPlaying()) setIdleStrip();
      }, 600);
    }
  }

  async function submitQuestion(question: string) {
    const intent = classifyTurnIntent(question);
    if (intent === "stop") {
      await handleStop();
      return;
    }
    if (intent === "replay") {
      await handleReplay();
      return;
    }
    if (!isIntelligibleQuestion(question)) {
      resetCollect();
      setIdleStrip();
      return;
    }

    busy = true;
    opts.onUi({ strip: "turn", line: null });
    try {
      const result = await runCalledTurnIntoCall(
        opts.getRoom(),
        opts.getCaptureSessionId(),
        {
          question,
          askedBy: opts.getAskedBy(),
          offsetMs: opts.getOffsetMs(),
          riderFirst: opts.getRiderFirst(),
          trainerFirst: opts.getTrainerFirst(),
          crossingLineAlreadySaid: crossingSaid,
          declinedTexts: declined,
          intent: "ask",
        },
        opts.getAuthHeaders
      );

      if (result.silent || !result.text) {
        setIdleStrip();
        return;
      }

      if (result.crossingSaid) crossingSaid = true;
      if (result.kind === "exercise" || (result.text && result.text.length > 80)) {
        lastExerciseText = result.text;
      }

      opts.onUi({ strip: "turn", line: result.text });
      broadcastTurn(result.text);
      openFollowUp();
    } finally {
      busy = false;
      cooldownUntil = Date.now() + COOLDOWN_MS;
      window.setTimeout(() => {
        if (!collecting && !isVectorPlaying()) setIdleStrip();
      }, FOLLOW_UP_MS + 200);
    }
  }

  function finishCollect() {
    if (!collecting) return;
    const q = buffer.trim();
    resetCollect();
    void submitQuestion(q);
  }

  function bumpSilence() {
    if (silenceTimer != null) window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => {
      finishCollect();
    }, SILENCE_MS);
  }

  function beginCollect(seed: string) {
    collecting = true;
    buffer = seed;
    opts.onUi({ strip: "turn" });
    clearCollectTimers();
    capTimer = window.setTimeout(() => finishCollect(), CAP_MS);
    if (isIntelligibleQuestion(seed)) {
      // Same-breath question — still wait a short beat for trailing words
      bumpSilence();
    } else {
      bumpSilence();
    }
  }

  async function onWake(residual: string) {
    if (disposed || busy || collecting) return;
    if (Date.now() < cooldownUntil) return;
    await playWakeEarcon();
    opts.onUi({ strip: "turn" });
    if (isIntelligibleQuestion(residual)) {
      const intent = classifyTurnIntent(residual);
      if (intent === "stop") {
        await handleStop();
        return;
      }
      if (intent === "replay") {
        await handleReplay();
        return;
      }
      beginCollect(residual);
      return;
    }
    // False-wake path: wait for a question; empty → zero output
    beginCollect("");
  }

  return {
    dispose() {
      disposed = true;
      resetCollect();
      stopVectorPlayback();
    },
    onRemoteTurn(text: string) {
      if (!text.trim()) return;
      opts.onUi({ strip: "turn", line: text });
      lastExerciseText = text.length > 80 ? text : lastExerciseText;
      openFollowUp();
    },
    onRemoteStop() {
      stopVectorPlayback();
      resetCollect();
      setIdleStrip();
    },
    /** Trainer barge-in while Vector is speaking. */
    onTrainerVoice() {
      if (!isVectorPlaying()) return;
      void handleStop();
    },
    onAsrInterim(text: string) {
      if (!opts.isArmed() || !opts.isCaptureLive()) return;
      if (collecting && text.trim()) {
        buffer = `${buffer} ${text}`.replace(/\s+/g, " ").trim();
        bumpSilence();
      }
    },
    onAsrFinal(text: string) {
      if (!opts.isArmed() || !opts.isCaptureLive()) return;
      const cleaned = text.replace(/\s+/g, " ").trim();
      if (!cleaned) return;

      // Barge-in: trainer speech while Vector plays
      if (
        isVectorPlaying() &&
        opts.getAskedBy() === "trainer" &&
        cleaned.length > 2
      ) {
        void handleStop();
        return;
      }

      if (busy) return;

      // Stop / replay while Vector speaking (either party)
      if (isVectorPlaying() && isStopPhrase(cleaned)) {
        void handleStop();
        return;
      }

      if (collecting) {
        const { hit, residual } = splitWakeUtterance(cleaned);
        const piece = hit ? residual : cleaned;
        if (piece) {
          buffer = `${buffer} ${piece}`.replace(/\s+/g, " ").trim();
        }
        bumpSilence();
        return;
      }

      // Follow-up window — no wake required, address must be clear
      if (Date.now() < followUpUntil) {
        if (isStopPhrase(cleaned)) {
          void handleStop();
          return;
        }
        if (classifyTurnIntent(cleaned) === "replay") {
          void handleReplay();
          return;
        }
        if (isAddressedToVector(cleaned)) {
          const { residual } = splitWakeUtterance(cleaned);
          const q = residual || cleaned.replace(/\bvector\b/gi, "").trim();
          if (isIntelligibleQuestion(q)) {
            void submitQuestion(q);
          }
          return;
        }
        // Ambiguous → silence
        return;
      }

      const { hit, residual } = splitWakeUtterance(cleaned);
      if (hit) {
        void onWake(residual);
      }
    },
  };
}

export type CalledTurnRuntime = ReturnType<typeof createCalledTurnRuntime>;
