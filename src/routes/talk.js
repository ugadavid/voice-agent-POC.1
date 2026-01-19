import fs from "fs";
import { upload, renameWithOriginalExtension } from "../utils/uploads.js";
import { withRetry } from "../utils/retry.js";
import { MODELS, VOICES, DEFAULTS } from "../constants.js";
import { synthesizeMp3Base64 } from "../services/tts.js";
import { toHttpError } from "../utils/errors.js";

export function registerTalkRoute(app, { openai, SYSTEM_PROMPT }) {
  app.post("/api/talk", upload.single("audio"), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No audio file provided." });

    const renamedPath = renameWithOriginalExtension(file);

    try {
      // 1) STT
      const transcript = await withRetry(() =>
        openai.audio.transcriptions.create({
          file: fs.createReadStream(renamedPath),
          model: MODELS.TRANSCRIBE,
        })
      );

      const userText = (transcript.text || "").trim();

      // 2) LLM reply
      const completion = await withRetry(() =>
        openai.chat.completions.create({
          model: MODELS.CHAT,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: userText || "Peux-tu te présenter et expliquer le projet en quelques phrases ?",
            },
          ],
        })
      );

      const replyText =
        completion.choices?.[0]?.message?.content?.trim() || "D'accord.";

      // 3) TTS → MP3
      const audioMp3Base64 = await synthesizeMp3Base64(openai, replyText);

      res.json({
        transcript: userText,
        replyText,
        audioMp3Base64,
      });

    } catch (err) {
      console.error("❌ /api/talk error:", err);
      const { status, message } = toHttpError(err);
      res.status(status).json({ error: message });
    } finally {
      // Cleanup temp file (tu l’avais commenté)
      // fs.unlink(renamedPath, () => {});
    }
  });
}
