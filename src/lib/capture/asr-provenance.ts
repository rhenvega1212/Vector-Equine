/**
 * A8 · provenance.
 *
 * Every transcript segment records what produced it. The point is not
 * bookkeeping: the baseline session is the fixed point every later accuracy
 * number is compared against, and a comparison between two transcripts made
 * under different configurations is meaningless.
 *
 * The values come from the same constants used to build the request, because
 * `verbose_json` does not echo the model back. Hardcoding them a second time
 * here is how `model` keeps saying `whisper-1` after someone changes it —
 * which is worse than recording nothing.
 */

import {
  EQUINE_VOCAB_PROMPT_VERSION,
  WHISPER_MODEL,
} from "@/lib/capture/whisper";

/** Where the transcript was produced. Edge arrives with tier 2. */
export type ProducingPath = "cloud" | "edge";

export type AsrProvenance = {
  engine: "whisper" | "browser";
  model: string | null;
  prompt_version: string | null;
  /** Voice activity detection parameters. Null until A5 — shape is fixed now. */
  vad: null;
  producing_path: ProducingPath;
};

export function whisperProvenance(
  producingPath: ProducingPath = "cloud"
): AsrProvenance {
  return {
    engine: "whisper",
    model: WHISPER_MODEL,
    prompt_version: EQUINE_VOCAB_PROMPT_VERSION,
    vad: null,
    producing_path: producingPath,
  };
}

/** Live browser SpeechRecognition. Model and prompt are not ours to know. */
export function browserProvenance(
  producingPath: ProducingPath = "cloud"
): AsrProvenance {
  return {
    engine: "browser",
    model: null,
    prompt_version: null,
    vad: null,
    producing_path: producingPath,
  };
}
