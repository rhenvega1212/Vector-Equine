/**
 * Brief 14 Phase 4 — trainer-track VAD + TTS barge-in.
 * Behaviour locked; thresholds tunable.
 *
 * Gate: arena mixed-channel recording (not two laptop tabs).
 */

export type ChannelControlState = {
  trainerSpeaking: boolean;
  vectorPlaying: boolean;
};

export type ChannelControlHandlers = {
  onHoldForGap: () => void;
  onBargeInStop: () => void;
};

/**
 * When trainer VAD goes active during Vector playback → stop, do not resume.
 * When trainer VAD active before Vector starts → wait for gap.
 */
export function applyChannelRule(
  state: ChannelControlState,
  handlers: ChannelControlHandlers
): void {
  if (state.trainerSpeaking && state.vectorPlaying) {
    handlers.onBargeInStop();
    return;
  }
  if (state.trainerSpeaking && !state.vectorPlaying) {
    handlers.onHoldForGap();
  }
}
