/**
 * ElevenLabs TTS — returns mp3 bytes or null if unconfigured / failed.
 * Complete mp3 (no streaming latency flag) so the session player can decode it.
 */

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MODEL_FALLBACKS = [
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_multilingual_v2",
] as const;

function uniqueModels(preferred: string): string[] {
  const out: string[] = [];
  for (const id of [preferred, ...MODEL_FALLBACKS]) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

async function requestTts(
  apiKey: string,
  voiceId: string,
  modelId: string,
  text: string
): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number }> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.trim().slice(0, 2500),
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(
      "ElevenLabs TTS failed",
      res.status,
      modelId,
      voiceId.slice(0, 6),
      err.slice(0, 240)
    );
    return { ok: false, status: res.status };
  }
  return { ok: true, buf: await res.arrayBuffer() };
}

export async function synthesizeAskSpeech(
  text: string
): Promise<ArrayBuffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || !text.trim()) return null;

  const configuredVoice =
    process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const voices = [configuredVoice];
  if (configuredVoice !== DEFAULT_VOICE_ID) voices.push(DEFAULT_VOICE_ID);

  const models = uniqueModels(
    process.env.ELEVENLABS_MODEL_ID?.trim() || MODEL_FALLBACKS[0]
  );

  try {
    for (const voiceId of voices) {
      for (const modelId of models) {
        const result = await requestTts(apiKey, voiceId, modelId, text);
        if (result.ok && result.buf.byteLength > 0) return result.buf;
        if (!result.ok && (result.status === 401 || result.status === 403)) {
          return null;
        }
        // 404 on a custom voice — try the default voice next
        if (!result.ok && result.status === 404 && voiceId !== DEFAULT_VOICE_ID) {
          break;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("ElevenLabs TTS error", e);
    return null;
  }
}
