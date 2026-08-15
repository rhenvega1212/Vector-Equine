import { createOpenAI } from "@ai-sdk/openai";
import { transcribe } from "ai";

const EQUINE_VOCAB_PROMPT =
  "Equestrian riding lesson between a trainer and rider. Common words: walk, trot, canter, gallop, halt, half-halt, inside leg, outside rein, contact, collection, tempo, rhythm, circle, diagonal, transition, seat, hands, leg yield, shoulder-in, lengthen, shorten, balance, forward, straight, bend.";

export type WhisperSeg = {
  text: string;
  offset_ms: number;
  ended_offset_ms: number;
  confidence: number | null;
};

export function isWhisperConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() || process.env.AI_GATEWAY_API_KEY?.trim()
  );
}

/**
 * Transcribe a lesson audio chunk with OpenAI Whisper.
 * `syncOffsetMs` is when this chunk started relative to capture t0.
 */
export async function transcribeLessonAudio(opts: {
  audio: Uint8Array | ArrayBuffer | Buffer;
  syncOffsetMs: number;
  mediaType?: string;
}): Promise<WhisperSeg[]> {
  if (!isWhisperConfigured()) return [];

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const openai = createOpenAI({
    apiKey: openaiKey || process.env.AI_GATEWAY_API_KEY!.trim(),
    ...(openaiKey
      ? {}
      : { baseURL: "https://ai-gateway.vercel.sh/v1" }),
  });

  const result = await transcribe({
    model: openai.transcription("whisper-1"),
    audio: opts.audio,
    providerOptions: {
      openai: {
        language: "en",
        prompt: EQUINE_VOCAB_PROMPT,
        // Segment timestamps → accurate offset_ms on the lesson timeline
        timestampGranularities: ["segment"],
      },
    },
  });

  const sync = Math.max(0, opts.syncOffsetMs | 0);

  if (result.segments?.length) {
    return result.segments
      .map((s) => {
        const text = (s.text || "").trim();
        if (!text) return null;
        const startMs = Math.round((s.startSecond || 0) * 1000);
        const endMs = Math.round((s.endSecond || s.startSecond || 0) * 1000);
        return {
          text,
          offset_ms: sync + startMs,
          ended_offset_ms: sync + Math.max(startMs, endMs),
          confidence: null as number | null,
        };
      })
      .filter((s): s is WhisperSeg => !!s);
  }

  const text = (result.text || "").trim();
  if (!text) return [];

  const durationMs = result.durationInSeconds
    ? Math.round(result.durationInSeconds * 1000)
    : 0;

  return [
    {
      text,
      offset_ms: sync,
      ended_offset_ms: sync + durationMs,
      confidence: null,
    },
  ];
}
