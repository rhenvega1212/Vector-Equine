/**
 * Transcribe lesson mic chunks with OpenAI Whisper.
 * Uses the REST API directly so the File keeps a real webm/mp4 type —
 * the AI SDK was rewriting Uint8Array uploads as audio.wav and Whisper rejected them.
 */

import {
  emptyQualitySignals,
  flagSegment,
  readQualitySignals,
  type QualitySignals,
} from "@/lib/capture/asr-flags";

/**
 * Whisper `prompt` is prior-text bias — never put "Hey Vector" or instructions
 * here; Whisper echoes them into silence as fake transcript / false wakes.
 */
/**
 * One definition, used both to build the request and to write provenance.
 * `verbose_json` does not echo the model back, so this constant is the only
 * thing that can keep the two honest.
 */
export const WHISPER_MODEL = "whisper-1";

const EQUINE_VOCAB_PROMPT =
  "Walk, trot, canter, halt, half-halt, inside leg, outside rein, contact, " +
  "collection, tempo, rhythm, circle, diagonal, transition, seat, leg yield, " +
  "shoulder-in, pirouette, piaffe, passage.";

/**
 * Bump when the prompt above changes. A transcript that cannot be traced to the
 * prompt that produced it cannot be compared to one made with a different one.
 */
export const EQUINE_VOCAB_PROMPT_VERSION = "equine-vocab-v1";

export type WhisperSeg = {
  /** Verbatim, as Whisper returned it. Cleanup happens at the storage boundary. */
  text: string;
  offset_ms: number;
  ended_offset_ms: number;
  confidence: number | null;
  quality: QualitySignals;
  excluded_from_corpus: boolean;
  exclusion_reason: string | null;
};

export function isWhisperConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() || process.env.AI_GATEWAY_API_KEY?.trim()
  );
}

function toUint8(audio: Uint8Array | ArrayBuffer | Buffer): Uint8Array {
  if (audio instanceof Uint8Array) return audio;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(audio)) {
    return new Uint8Array(audio);
  }
  return new Uint8Array(audio as ArrayBuffer);
}

function resolveAudioMeta(
  buf: Uint8Array,
  mediaType?: string
): { type: string; ext: string } {
  const head = buf.subarray(0, 12);
  const isEbml =
    head.length >= 4 &&
    head[0] === 0x1a &&
    head[1] === 0x45 &&
    head[2] === 0xdf &&
    head[3] === 0xa3;
  const isFtyp =
    head.length >= 8 &&
    head[4] === 0x66 &&
    head[5] === 0x74 &&
    head[6] === 0x79 &&
    head[7] === 0x70;
  const isRiff =
    head.length >= 4 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46;

  let type = (mediaType || "").split(";")[0].trim().toLowerCase();

  if (isEbml || type.includes("webm")) {
    return { type: "audio/webm", ext: "webm" };
  }
  if (isFtyp || type.includes("mp4") || type.includes("m4a")) {
    return { type: "audio/mp4", ext: "mp4" };
  }
  if (isRiff || type.includes("wav")) {
    return { type: "audio/wav", ext: "wav" };
  }
  if (type.includes("mpeg") || type.includes("mp3")) {
    return { type: "audio/mpeg", ext: "mp3" };
  }
  if (type.includes("ogg")) {
    return { type: "audio/ogg", ext: "ogg" };
  }
  return { type: type || "audio/webm", ext: type.includes("mp4") ? "mp4" : "webm" };
}

type WhisperVerboseJson = {
  text?: string;
  duration?: number;
  segments?: Array<{
    text?: string;
    start?: number;
    end?: number;
    no_speech_prob?: number;
    avg_logprob?: number;
    compression_ratio?: number;
  }>;
};

/**
 * Transcribe a lesson audio chunk with OpenAI Whisper.
 * `syncOffsetMs` is when this chunk started relative to capture t0.
 */
export async function transcribeLessonAudio(opts: {
  audio: Uint8Array | ArrayBuffer | Buffer | Blob;
  syncOffsetMs: number;
  mediaType?: string;
}): Promise<WhisperSeg[]> {
  if (!isWhisperConfigured()) return [];

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const apiKey = openaiKey || gatewayKey;
  if (!apiKey) return [];

  const baseURL = openaiKey
    ? "https://api.openai.com/v1"
    : "https://ai-gateway.vercel.sh/v1";

  let bytes: Uint8Array;
  let typeHint = opts.mediaType;

  if (typeof Blob !== "undefined" && opts.audio instanceof Blob) {
    bytes = new Uint8Array(await opts.audio.arrayBuffer());
    typeHint = typeHint || opts.audio.type;
  } else {
    bytes = toUint8(opts.audio as Uint8Array | ArrayBuffer | Buffer);
  }

  if (bytes.byteLength < 256) return [];

  const { type, ext } = resolveAudioMeta(bytes, typeHint);
  // Copy into a plain ArrayBuffer-backed view for BlobPart typing
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type });

  const form = new FormData();
  form.append("file", blob, `chunk.${ext}`);
  form.append("model", WHISPER_MODEL);
  form.append("language", "en");
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  form.append("prompt", EQUINE_VOCAB_PROMPT);
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch(`${baseURL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Whisper ${res.status}: ${errText.slice(0, 240)}`);
  }

  const result = (await res.json()) as WhisperVerboseJson;
  const sync = Math.max(0, opts.syncOffsetMs | 0);

  // Text is returned verbatim and low-quality segments are flagged, not
  // dropped. Silence still produces nothing, but a segment this function
  // doubts is the caller's to keep — see asr-flags.
  if (result.segments?.length) {
    return result.segments
      .map((s) => {
        // Not trimmed: `text` is stored byte-identical to the response, and
        // Whisper's segments carry a leading space. Readers normalise.
        const raw = s.text || "";
        if (!raw.trim()) return null;
        const quality = readQualitySignals(s);
        const flag = flagSegment(raw, quality);
        const startMs = Math.round((s.start || 0) * 1000);
        const endMs = Math.round((s.end || s.start || 0) * 1000);
        return {
          text: raw,
          offset_ms: sync + startMs,
          ended_offset_ms: sync + Math.max(startMs, endMs),
          confidence: null as number | null,
          quality,
          excluded_from_corpus: flag.excluded,
          exclusion_reason: flag.reason,
        };
      })
      .filter((s): s is WhisperSeg => !!s);
  }

  const raw = result.text || "";
  if (!raw.trim()) return [];

  const quality = emptyQualitySignals();
  const flag = flagSegment(raw, quality);
  const durationMs = result.duration ? Math.round(result.duration * 1000) : 0;

  return [
    {
      text: raw,
      offset_ms: sync,
      ended_offset_ms: sync + durationMs,
      confidence: null,
      quality,
      excluded_from_corpus: flag.excluded,
      exclusion_reason: flag.reason,
    },
  ];
}
