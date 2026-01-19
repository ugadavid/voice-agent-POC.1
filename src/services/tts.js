import { MODELS, VOICES, DEFAULTS } from "../constants.js";
import { withRetry } from "../utils/retry.js";

export async function synthesizeMp3Base64(openai, text) {
  const tts = await withRetry(() =>
    openai.audio.speech.create({
      model: MODELS.TTS,
      voice: VOICES.DEFAULT,
      input: String(text || DEFAULTS.FALLBACK_REPLY),
    })
  );

  const audioBuffer = Buffer.from(await tts.arrayBuffer());
  return audioBuffer.toString("base64");
}
