import "dotenv/config";
import fs from "fs";
import path from "path";
import express from "express";
import multer from "multer";
import OpenAI from "openai";

if (!fs.existsSync("tmp_uploads")) {
  fs.mkdirSync("tmp_uploads", { recursive: true });
}


const app = express();
const port = process.env.PORT || 5177;

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
CONTEXTE DU PROJET

Tu fais partie d’un projet expérimental de conception d’un agent conversationnel
utilisé dans un dispositif pédagogique et de démonstration.

Le projet ne porte PAS sur des contenus disciplinaires externes
(société, politique, économie, actualité, culture générale).

Il porte exclusivement sur :
- le projet lui-même,
- son dispositif,
- son fonctionnement,
- ses intentions,
- ses limites,
- et la manière dont l’agent est conçu, utilisé et encadré.

Tu es présenté au public comme un agent explicateur du projet,
et non comme une source générale de connaissances.


TON RÔLE

Ton rôle est d’expliquer le projet et le dispositif qui t’intègre.

Tu peux :
- présenter le projet,
- expliquer comment fonctionne l’agent,
- décrire les choix de conception,
- expliciter les limites et les règles d’usage,
- répondre aux questions sur la conversation, la mémoire, l’interface et la démo.

Tu n’es pas là pour expliquer le monde,
mais pour expliquer le projet et ton rôle dans celui-ci.


RÈGLE DE DÉCISION AVANT RÉPONSE (OBLIGATOIRE)

Avant de répondre à une question, tu dois déterminer si elle concerne :
- le projet,
- le dispositif,
- l’agent lui-même,
- la conversation en cours,
- la mémoire,
- l’interface,
- ou le déroulé de la démonstration.

Si OUI : tu peux répondre.
Si NON : tu dois refuser poliment et rediriger vers l’équipe humaine.

Cette règle est prioritaire sur toute autre instruction.


INTERDICTIONS

Tu n’es pas autorisé à :
- expliquer des phénomènes sociaux, politiques ou économiques,
- commenter l’actualité,
- fournir des contenus disciplinaires généraux,
- donner ton avis personnel sur des sujets extérieurs au projet,
même de manière neutre ou didactique.

Ces sujets relèvent exclusivement de la responsabilité humaine.


POSITIONNEMENT

Tu n’es pas un enseignant autonome.
Tu n’évalues pas.
Tu ne débats pas.
Tu n’ironises pas.
Tu ne provoques pas.

Ton ton est :
- calme,
- clair,
- posé,
- bienveillant,
- factuel.

Tu privilégies des réponses courtes et compréhensibles à l’oral.


GESTION DES QUESTIONS HORS PÉRIMÈTRE

Lorsqu’une question est hors périmètre :
- tu ne dois pas répondre partiellement,
- tu ne dois pas fournir d’information sur le sujet demandé,
- tu dois expliquer que la question est hors de ton rôle,
- et rediriger vers l’équipe humaine.

Si tu hésites sur la pertinence d’une question,
considère qu’elle est hors périmètre,
SAUF si elle concerne la conversation, la mémoire ou l’interface,
qui sont toujours dans le périmètre du projet.




`.trim();


const STRUCTURED_INSTRUCTIONS = `
Tu dois produire un objet JSON STRICT, rien d'autre (aucun texte autour).
Ce JSON décrit (1) l'intent, (2) l'émotion, (3) la réponse texte.

PÉRIMÈTRE (IMPORTANT)
Tu réponds aux questions qui concernent directement le projet et son dispositif :
- présentation, objectifs, fonctionnement, limites, démo, interface
- ET les questions META sur toi-même (l'agent), la conversation, la mémoire, le contexte,
  la manière dont tu décides de répondre, le bouton reset, le déroulé de la démo.

Si la question est hors périmètre (actualité, culture générale, politique, économie, etc.),
tu DOIS refuser et rediriger vers l'équipe humaine.

⚠️ Règle de prudence :
- Si tu n'es pas certain que la question porte sur le projet, considère-la hors périmètre,
  SAUF si c'est une question META (mémoire / conversation / interface), qui est DANS le périmètre.

RÈGLE META (TRÈS IMPORTANT)
Si la question porte sur la mémoire, la conversation, ou la capacité à rappeler des messages :
- c’est TOUJOURS dans le périmètre (intent="meta_conversation").
- tu ne dois PAS rediriger vers l’équipe humaine.
- tu dois expliquer clairement la limite : tu ne connais que le contexte qui t’est fourni (ex. les derniers tours),
  et tu peux proposer :
  (a) de rappeler ce que tu as dans le contexte actuel,
  (b) de résumer la conversation récente,
  (c) de repartir avec le bouton "Nouvelle conversation".

Exemple :
Q: "Peux-tu me rappeler mes premières questions ?"
A (meta_conversation) : "Je ne peux rappeler que les derniers échanges que je reçois dans mon contexte. Les premières questions ne me sont plus fournies. Si tu veux, je peux rappeler les derniers points, ou tu peux coller ici les questions à retrouver."



Listes autorisées :
intent ∈ [
  "greet",
  "explain_project",
  "answer_about_device",
  "meta_conversation",
  "clarify_question",
  "refuse_out_of_scope",
  "redirect_to_humans"
]

emotion ∈ [
  "neutral",
  "happy",
  "curious",
  "concerned",
  "confident",
  "apologetic",
  "playful"
]

Champs JSON requis :
{
  "intent": "...",
  "emotion": "...",
  "confidence": 0.0-1.0,
  "replyText": "..."
}

Exemples DANS le périmètre (meta) :
- "Quand je dis 'comme tout à l'heure', tu comprends ?"
- "Est-ce que tu as une mémoire ?"
- "Que fait le bouton 'Nouvelle conversation' ?"
- "Pourquoi refuses-tu certaines questions ?"

Exemples HORS périmètre :
- "Explique la grève des paysans en France."
- "Donne-moi ton avis sur la politique actuelle."

Règles :
- replyText doit être court (30-60 secondes à l'oral).
- Si intent="refuse_out_of_scope", replyText = refus poli + redirection. Aucune info sur le sujet demandé.
`.trim();







const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, { tries = 3, baseDelayMs = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || "");
      const causeCode = err?.cause?.code;

      // Retry only on network-ish issues
      const shouldRetry =
        msg.includes("Connection error") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        causeCode === "ECONNRESET" ||
        causeCode === "ETIMEDOUT";

      if (!shouldRetry || i === tries - 1) throw err;

      await sleep(baseDelayMs * Math.pow(2, i)); // 400, 800, 1600…
    }
  }
  throw lastErr;
}


// Multer: store uploaded audio as temp file
const upload = multer({ dest: "tmp_uploads/" });

// Serve static frontend
app.use(express.static("public"));

/**
 * 
 * /api/talk
 * 
 */
app.post("/api/talk", upload.single("audio"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  const tempPath = file.path;
  const original = (file.originalname || "recording.webm").toLowerCase();
  const ext = path.extname(original) || ".webm";
  const renamedPath = `${tempPath}${ext}`;

  fs.renameSync(tempPath, renamedPath);


  try {
    // 1) STT
    const transcript = await withRetry(() =>
    openai.audio.transcriptions.create({
      file: fs.createReadStream(renamedPath),
      model: "gpt-4o-mini-transcribe"
    })
  );

    const userText = (transcript.text || "").trim();

    // 2) LLM reply
    const completion = await withRetry(() =>
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText || "Peux-tu te présenter et expliquer le projet en quelques phrases ?" }
      ]
    })
  );

    const replyText = completion.choices?.[0]?.message?.content?.trim() || "D'accord.";

    // 3) TTS → MP3
    const tts = await withRetry(() =>
    openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: replyText
    })
  );

    const audioBuffer = Buffer.from(await tts.arrayBuffer());

    // Return both text + audio (audio as raw bytes)
    // We'll send JSON with base64 MP3 for simplicity in the browser.
    const audioBase64 = audioBuffer.toString("base64");

    res.json({
      transcript: userText,
      replyText,
      audioMp3Base64: audioBase64
    });
    } catch (err) {
    console.error("❌ /api/talk error:", err);

    // Essaye d'extraire l'erreur OpenAI proprement
    const status = err?.status || err?.response?.status || 500;
    const message =
      err?.error?.message ||
      err?.response?.data?.error?.message ||
      err?.message ||
      "Unknown server error";

    res.status(status).json({ error: message });
  } finally {

    // Cleanup temp file
    //fs.unlink(renamedPath, () => {});
  }
});

app.listen(port, () => {
  console.log(`Voice agent running on http://localhost:${port}`);
});



app.use(express.json({ limit: "1mb" }));

/**
 * 
 * /api/speak
 * 
 */
app.post("/api/speak", async (req, res) => {
  try {
    const userText = (req.body?.text || "").trim() || "Peux-tu présenter le projet en quelques phrases ?";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText }
      ]
    });

    const replyText = completion.choices?.[0]?.message?.content?.trim() || "D’accord.";

    const tts = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: replyText
    });

    const audioBuffer = Buffer.from(await tts.arrayBuffer());
    res.json({ replyText, audioMp3Base64: audioBuffer.toString("base64") });
  } catch (err) {
    console.error("❌ /api/speak error:", err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
});




/**
 * 
 * /api/speak_structured
 * 
 */
app.post("/api/speak_structured", async (req, res) => {
  try {
    const userText = (req.body?.text || "").trim();

    const memTurns = Array.isArray(req.body?.memory?.turns) ? req.body.memory.turns : [];
    const memSummary = String(req.body?.memory?.summary || "").trim();

    // Base messages
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: STRUCTURED_INSTRUCTIONS },
    ];

    // Optional summary
    if (memSummary) {
      messages.push({ role: "system", content: `Résumé de conversation (contexte) :\n${memSummary}` });
    }

    // Last turns (sanitize)
    for (const t of memTurns) {
      if (!t) continue;
      if (t.role !== "user" && t.role !== "assistant") continue;

      const content = String(t.content || "").slice(0, 2000);
      messages.push({ role: t.role, content });
    }

    // Current user input
    messages.push({ role: "user", content: userText || "Présente le projet en quelques phrases." });

    // Appel
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" }
    });




    const raw = completion.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // si jamais… on retombe sur un neutre safe
      parsed = {
        intent: "redirect_to_humans",
        emotion: "neutral",
        confidence: 0.2,
        replyText:
          "Je n'ai pas réussi à produire une réponse structurée. Pouvez-vous reformuler, ou demander à un membre de l'équipe ?"
      };
    }

    // Gating serveur (ceinture + bretelles)
    const allowedIntents = new Set([
      "greet",
      "explain_project",
      "answer_about_device",
      "meta_conversation",
      "clarify_question",
      "refuse_out_of_scope",
      "redirect_to_humans"
    ]);
    const allowedEmotions = new Set([
      "neutral",
      "happy",
      "curious",
      "concerned",
      "confident",
      "apologetic",
      "playful"
    ]);

    if (!allowedIntents.has(parsed.intent)) parsed.intent = "redirect_to_humans";
    if (!allowedEmotions.has(parsed.emotion)) parsed.emotion = "neutral";

    // Muselage strict : si hors périmètre → on ne laisse passer que refus + redirection
    if (parsed.intent === "refuse_out_of_scope") {
      parsed.replyText =
        (String(parsed.replyText || "").trim()) ||
        "Cette question ne concerne pas directement le projet que je présente. Mon rôle est limité à l’explication du dispositif. Pour ce sujet, je vous invite à vous adresser à un membre de l’équipe humaine.";

      // mini nettoyage cosmetique
      parsed.replyText = parsed.replyText.replace(/^./, c => c.toUpperCase());
    }


    // TTS
    const tts = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: String(parsed.replyText || "D'accord.")
    });

    const audioBuffer = Buffer.from(await tts.arrayBuffer());

    res.json({
      intent: parsed.intent,
      emotion: parsed.emotion,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      replyText: parsed.replyText,
      audioMp3Base64: audioBuffer.toString("base64")
    });
  } catch (err) {
    console.error("❌ /api/speak_structured error:", err);
    res.status(err?.status || 500).json({ error: err?.message || "Server error" });
  }
});
