import { MODELS, VOICES, DEFAULTS } from "../constants.js";
import { synthesizeMp3Base64 } from "../services/tts.js";
import { toHttpError } from "../utils/errors.js";

export function registerSpeakRoute(app, { openai, SYSTEM_PROMPT }) {
  app.post("/api/speak", async (req, res) => {
    try {
      const userText =
        (req.body?.text || "").trim() || "Peux-tu présenter le projet en quelques phrases ?";

      const completion = await openai.chat.completions.create({
        model: MODELS.CHAT,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userText },
        ],
      });

      const replyText =
        completion.choices?.[0]?.message?.content?.trim() || "D’accord.";

      const audioMp3Base64 = await synthesizeMp3Base64(openai, replyText);

      res.json({
        transcript: userText,
        replyText,
        audioMp3Base64,
      });

    } catch (err) {
      console.error("❌ /api/speak error:", err);
      const { status, message } = toHttpError(err);
      res.status(status).json({ error: message });
    }
  });
}
