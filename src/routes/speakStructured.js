import { MODELS, VOICES, DEFAULTS, MEMORY, SCHEMA } from "../constants.js";
import { sanitizeIntent, sanitizeEmotion } from "../utils/sanitize.js";
import { synthesizeMp3Base64 } from "../services/tts.js";
import { toHttpError } from "../utils/errors.js";

export function registerSpeakStructuredRoute(app, { openai, SYSTEM_PROMPT, STRUCTURED_INSTRUCTIONS }) {
  app.post("/api/speak_structured", async (req, res) => {
    try {
      const userText = (req.body?.text || "").trim();

      const memTurns = Array.isArray(req.body?.memory?.turns) ? req.body.memory.turns : [];
      const memSummary = String(req.body?.memory?.summary || "").trim();

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: STRUCTURED_INSTRUCTIONS },
      ];

      if (memSummary) {
        messages.push({ role: "system", content: `Résumé de conversation (contexte) :\n${memSummary}` });
      }

      for (const t of memTurns) {
        if (!t) continue;
        if (t.role !== "user" && t.role !== "assistant") continue;

        const content = String(t.content || "").slice(0, MEMORY.MAX_CONTENT_CHARS);
        messages.push({ role: t.role, content });
      }

      messages.push({ role: "user", content: userText || "Présente le projet en quelques phrases." });

      const completion = await openai.chat.completions.create({
        model: MODELS.CHAT,
        messages,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          intent: "redirect_to_humans",
          emotion: "neutral",
          confidence: 0.2,
          replyText:
            "Je n'ai pas réussi à produire une réponse structurée. Pouvez-vous reformuler, ou demander à un membre de l'équipe ?",
        };
      }

      const allowedIntents = new Set(SCHEMA.ALLOWED_INTENTS);
      const allowedEmotions = new Set(SCHEMA.ALLOWED_EMOTIONS);

      if (!allowedIntents.has(parsed.intent)) parsed.intent = sanitizeIntent(parsed.intent);
      if (!allowedEmotions.has(parsed.emotion)) parsed.emotion = sanitizeEmotion(parsed.emotion);

      if (parsed.intent === "refuse_out_of_scope") {
        parsed.replyText =
          String(parsed.replyText || "").trim() ||
          "Cette question ne concerne pas directement le projet que je présente. Mon rôle est limité à l’explication du dispositif. Pour ce sujet, je vous invite à vous adresser à un membre de l’équipe humaine.";
        parsed.replyText = parsed.replyText.replace(/^./, (c) => c.toUpperCase());
      }

      const audioMp3Base64 = await synthesizeMp3Base64(
        openai,
        parsed.replyText
      );


      res.json({
        intent: parsed.intent,
        emotion: parsed.emotion,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        replyText: parsed.replyText,
        audioMp3Base64,
      });

    } catch (err) {
      const { status, message } = toHttpError(err);
      res.status(status).json({ error: message });
    }
  });
}
