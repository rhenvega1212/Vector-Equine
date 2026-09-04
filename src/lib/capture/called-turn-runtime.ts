/**
 * Client-side called-turn state machine (Brief 14 Phase 5 + reply window).
 * Driven by local ASR finals/interims after wake arms.
 *
 * Shape of a turn:
 *   wake (earcon) → "Yes?" if nothing was asked → question → answer
 *   → "Anything else?" → another question, or the rider closes it.
 */

import { isGarbageTurnText } from "@/lib/capture/asr-cleanup";
import { playCloseEarcon, playWakeEarcon } from "@/lib/capture/vector-earcon";
import {
  isVectorPlaying,
  runCalledTurnIntoCall,
  speakVectorIntoCall,
  stopVectorPlayback,
} from "@/lib/capture/play-vector-audio";
import {
  classifyTurnIntent,
  isAddressedToVector,
  isAffirmativeReply,
  isIntelligibleQuestion,
  isLikelyVectorEcho,
  isNegativeReply,
  isStopPhrase,
  splitWakeUtterance,
} from "@/lib/capture/wake-word";
import type { Room } from "livekit-client";

const SILENCE_MS = 1600;
/** Incomplete trailing words — wait longer before firing the turn. */
const SILENCE_INCOMPLETE_MS = 3200;
/** After "Yes?" — the rider is gathering the question. */
const SILENCE_EMPTY_MS = 12_000;
const CAP_MS = 16_000;
/** Corrections land late; keep accepting them after the strip goes quiet. */
const FOLLOW_UP_MS = 25_000;
/** "Anything else?" waits about as long as a person would. */
const ANYTHING_ELSE_MS = 10_000;
const COOLDOWN_MS = 600;

const ACK_LINE = "Yes?";
const ANYTHING_ELSE_LINE = "Anything else?";

/** Rider pushing back on the answer — always earns a reply. */
const CORRECTION_RE =
  /\b(that'?s\s+not|that\s+isn'?t|not\s+what\s+i|i\s+(?:said|asked)|wrong|no,?\s+i|i\s+meant|try\s+again|different\s+one|something\s+else)\b/i;

export function isCorrection(text: string): boolean {
  return CORRECTION_RE.test(text.replace(/\s+/g, " ").trim());
}

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

function sanitizePiece(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || isGarbageTurnText(t)) return "";
  return t;
}

export function createCalledTurnRuntime(opts: CalledTurnRuntimeOpts) {
  let collecting = false;
  /** Finalized speech for this question. */
  let committed = "";
  /** Latest in-flight partial — replaced, never appended. */
  let interimTail = "";
  let silenceTimer: number | null = null;
  let capTimer: number | null = null;
  let anythingElseTimer: number | null = null;
  let followUpUntil = 0;
  /** Vector asked "Anything else?" and is waiting on the rider. */
  let awaitingMore = false;
  let crossingSaid = false;
  let lastExerciseText: string | null = null;
  let declined: string[] = [];
  let busy = false;
  let cooldownUntil = 0;
  let disposed = false;
  let history: Array<{ question: string; answer: string }> = [];
  /** What Vector is saying right now, so the mic doesn't quote it back. */
  let speakingLine = "";

  /** The open mic hears Vector too — that is not the rider talking. */
  function isEchoOfVector(piece: string): boolean {
    if (!speakingLine || !isVectorPlaying()) return false;
    return isLikelyVectorEcho(piece, speakingLine);
  }

  function questionSoFar(): string {
    return `${committed} ${interimTail}`.replace(/\s+/g, " ").trim();
  }

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

  function clearAnythingElseTimer() {
    if (anythingElseTimer != null) {
      window.clearTimeout(anythingElseTimer);
      anythingElseTimer = null;
    }
  }

  function resetCollect() {
    collecting = false;
    committed = "";
    interimTail = "";
    clearCollectTimers();
  }

  function setIdleStrip() {
    opts.onUi({ strip: "idle" });
  }

  /** Turn is over — back to listening for the next wake. */
  function closeTurn() {
    const wasOpen = awaitingMore || collecting;
    awaitingMore = false;
    followUpUntil = 0;
    clearAnythingElseTimer();
    resetCollect();
    setIdleStrip();
    // Sign off the way it signed on, so the rider knows it let go
    if (wasOpen) void playCloseEarcon();
  }

  function openFollowUp() {
    followUpUntil = Date.now() + FOLLOW_UP_MS;
  }

  /** Reply window after an answer — not the open bookend, not any TTS. */
  function inFollowUp(): boolean {
    return Date.now() < followUpUntil || awaitingMore;
  }

  function broadcastTurn(text: string) {
    opts.broadcast({
      type: "vector_turn",
      text,
      asker: opts.getAskedBy(),
    });
  }

  /** Speak a short Vector line in Vector's own voice. */
  async function speakLine(text: string): Promise<void> {
    opts.onUi({ strip: "turn", line: text });
    speakingLine = text;
    try {
      await speakVectorIntoCall(
        opts.getRoom(),
        opts.getCaptureSessionId(),
        {
          kind: "turn",
          text,
          offsetMs: opts.getOffsetMs(),
          persist: false,
        },
        opts.getAuthHeaders
      );
    } catch {
      /* the line is on screen either way */
    } finally {
      speakingLine = "";
    }
  }

  async function handleStop() {
    stopVectorPlayback();
    opts.broadcast({ type: "vector_stop" });
    closeTurn();
    busy = false;
  }

  async function handleReplay() {
    if (!lastExerciseText) {
      resetCollect();
      setIdleStrip();
      return;
    }
    busy = true;
    awaitingMore = false;
    clearAnythingElseTimer();
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
      cooldownUntil = Date.now() + COOLDOWN_MS;
      await promptAnythingElse();
    }
  }

  /** Close the loop like a person would, then wait a beat. */
  async function promptAnythingElse() {
    if (disposed) return;
    awaitingMore = true;
    openFollowUp();
    await speakLine(ANYTHING_ELSE_LINE);
    if (disposed || !awaitingMore) return;
    clearAnythingElseTimer();
    anythingElseTimer = window.setTimeout(() => {
      anythingElseTimer = null;
      // No answer — close quietly rather than nag
      if (awaitingMore && !busy && !collecting) closeTurn();
    }, ANYTHING_ELSE_MS);
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
    if (!isIntelligibleQuestion(question) || isGarbageTurnText(question)) {
      resetCollect();
      if (!awaitingMore) setIdleStrip();
      return;
    }

    busy = true;
    awaitingMore = false;
    clearAnythingElseTimer();
    // A correction rejects the answer it followed — don't offer it again
    if (isCorrection(question)) {
      const rejected = history[history.length - 1]?.answer;
      if (rejected && !declined.includes(rejected)) {
        declined = [...declined, rejected].slice(-12);
      }
      stopVectorPlayback();
    }
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
          priorTurns: history.slice(-3),
        },
        opts.getAuthHeaders
      );

      if (result.silent || !result.text) {
        closeTurn();
        return;
      }

      if (result.crossingSaid) crossingSaid = true;
      if (result.kind === "exercise" || result.text.length > 80) {
        lastExerciseText = result.text;
      }

      history = [...history, { question, answer: result.text }].slice(-3);
      opts.onUi({ strip: "turn", line: result.text });
      broadcastTurn(result.text);
      // runCalledTurnIntoCall already exhausts cloud + local speech; speaking
      // again here would say the answer twice
      busy = false;
      await promptAnythingElse();
    } finally {
      busy = false;
      cooldownUntil = Date.now() + COOLDOWN_MS;
    }
  }

  function finishCollect() {
    if (!collecting) return;
    const q = questionSoFar();
    resetCollect();
    if (!q) {
      // Nothing came after the wake — let it go quietly
      closeTurn();
      return;
    }
    void submitQuestion(q);
  }

  function looksIncomplete(q: string): boolean {
    const t = q.replace(/\s+/g, " ").trim().toLowerCase();
    if (!t) return false;
    if (/[?]$/.test(t)) return false;
    return /(?:\b(?:for|to|a|an|the|my|your|about|on|with|and|or|of)\s*$)/.test(
      t
    );
  }

  function bumpSilence() {
    if (silenceTimer != null) window.clearTimeout(silenceTimer);
    const q = questionSoFar();
    const wait = q
      ? looksIncomplete(q)
        ? SILENCE_INCOMPLETE_MS
        : SILENCE_MS
      : SILENCE_EMPTY_MS;
    silenceTimer = window.setTimeout(() => finishCollect(), wait);
  }

  function beginCollect(seed: string) {
    collecting = true;
    committed = sanitizePiece(seed);
    interimTail = "";
    awaitingMore = false;
    clearAnythingElseTimer();
    opts.onUi({ strip: "turn", line: null });
    clearCollectTimers();
    capTimer = window.setTimeout(() => finishCollect(), CAP_MS);
    bumpSilence();
  }

  async function onWake(residual: string) {
    if (disposed || busy || collecting) return;
    if (Date.now() < cooldownUntil) return;

    // The bing lands before anything else — the rider knows they were heard
    try {
      await playWakeEarcon();
    } catch {
      /* earcon best-effort */
    }

    const intent = residual ? classifyTurnIntent(residual) : "ask";
    if (residual && isIntelligibleQuestion(residual)) {
      if (intent === "stop") {
        await handleStop();
        return;
      }
      if (intent === "replay") {
        await handleReplay();
        return;
      }
      // Asked in one breath — go straight to the answer
      beginCollect(residual);
      return;
    }

    // Bare wake — answer, then listen. Collect first so a rider who starts
    // talking over the "Yes?" is still heard.
    beginCollect("");
    await speakLine(ACK_LINE);
    if (disposed || !collecting) return;
    // The clock on the question starts when Vector stops talking
    bumpSilence();
  }

  return {
    dispose() {
      disposed = true;
      awaitingMore = false;
      clearAnythingElseTimer();
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
      closeTurn();
    },
    /** Trainer barge-in while Vector is speaking. */
    onTrainerVoice() {
      if (!isVectorPlaying()) return;
      void handleStop();
    },
    onAsrInterim(text: string) {
      if (!opts.isArmed() || !opts.isCaptureLive()) return;
      const raw = text.replace(/\s+/g, " ").trim();
      if (!raw || isGarbageTurnText(raw)) return;
      if (isEchoOfVector(raw)) return;

      if (!collecting && !busy) {
        const { hit, residual } = splitWakeUtterance(raw);
        if (hit) {
          void onWake(residual);
          return;
        }
      }

      if (collecting) {
        const { hit, residual } = splitWakeUtterance(raw);
        // Partials replace the tail; finals are what accumulate
        interimTail = sanitizePiece(hit ? residual : raw);
        bumpSilence();
      }
    },
    onAsrFinal(text: string) {
      if (!opts.isArmed() || !opts.isCaptureLive()) return;
      const raw = text.replace(/\s+/g, " ").trim();
      if (!raw || isGarbageTurnText(raw)) return;
      if (isEchoOfVector(raw)) return;

      const cleaned = sanitizePiece(raw);
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

      if (isVectorPlaying() && isStopPhrase(cleaned)) {
        void handleStop();
        return;
      }

      if (busy) return;

      if (collecting) {
        const { hit, residual } = splitWakeUtterance(cleaned);
        const piece = sanitizePiece(hit ? residual : cleaned);
        if (piece) {
          committed = `${committed} ${piece}`.replace(/\s+/g, " ").trim();
        }
        interimTail = "";
        bumpSilence();
        return;
      }

      // "Anything else?" is on the table
      if (awaitingMore) {
        if (isNegativeReply(cleaned) || isStopPhrase(cleaned)) {
          stopVectorPlayback();
          closeTurn();
          return;
        }
        if (isAffirmativeReply(cleaned) && cleaned.split(/\s+/).length <= 3) {
          // "Yes" alone — wait for what they actually want
          stopVectorPlayback();
          clearAnythingElseTimer();
          beginCollect("");
          return;
        }
        if (classifyTurnIntent(cleaned) === "replay") {
          stopVectorPlayback();
          void handleReplay();
          return;
        }
        const { hit, residual } = splitWakeUtterance(cleaned);
        const q = sanitizePiece(hit ? residual : cleaned);
        if (q && isIntelligibleQuestion(q)) {
          stopVectorPlayback();
          clearAnythingElseTimer();
          beginCollect(q);
          return;
        }
        return;
      }

      // Reply window — the rider is still mid-conversation, no wake required
      if (inFollowUp()) {
        if (isStopPhrase(cleaned)) {
          void handleStop();
          return;
        }
        if (classifyTurnIntent(cleaned) === "replay") {
          void handleReplay();
          return;
        }
        if (isCorrection(cleaned)) {
          void submitQuestion(cleaned);
          return;
        }
        if (isAddressedToVector(cleaned)) {
          const { residual } = splitWakeUtterance(cleaned);
          const q = residual || cleaned.replace(/\bvector\b/gi, "").trim();
          if (isIntelligibleQuestion(q)) void submitQuestion(q);
          return;
        }
        if (!isVectorPlaying() && isIntelligibleQuestion(cleaned)) {
          void submitQuestion(cleaned);
          return;
        }
        return;
      }

      const { hit, residual } = splitWakeUtterance(cleaned);
      if (hit) void onWake(residual);
    },
  };
}

export type CalledTurnRuntime = ReturnType<typeof createCalledTurnRuntime>;
