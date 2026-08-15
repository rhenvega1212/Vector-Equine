/**
 * ElevenLabs TTS — returns mp3 bytes or null if unconfigured / failed.
 * Uses Flash by default for low latency in the Ask room.
 */
export async function synthesizeAskSpeech(
  text: string
): Promise<ArrayBuffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || !text.trim()) return null;

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
  const modelId =
    process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32&optimize_streaming_latency=3`,
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
      console.error("ElevenLabs TTS failed", res.status, await res.text());
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.error("ElevenLabs TTS error", e);
    return null;
  }
}
