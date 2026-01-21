import "dotenv/config";
import express from "express";

import { PORT } from "./src/config.js";
import { openai } from "./src/openaiClient.js";
import { SYSTEM_PROMPT } from "./src/prompts/systemPrompt.js";
import { STRUCTURED_INSTRUCTIONS } from "./src/prompts/structuredInstructions.js";
import { REALTIME_PROMPT } from "./src/prompts/realtimePrompt.js";

import { registerTalkRoute } from "./src/routes/talk.js";
import { registerSpeakRoute } from "./src/routes/speak.js";
import { registerSpeakStructuredRoute } from "./src/routes/speakStructured.js";
import { registerRealTimedRoute } from "./src/routes/realtime.js";

import { LIMITS } from "./src/constants.js";

const app = express();

// Middlewares (ordre important)
app.use(express.static("public"));
app.use(express.json({ limit: LIMITS.JSON_BODY_MB }));
//  realtime
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

// Dépendances partagées
//const deps = { openai, SYSTEM_PROMPT, STRUCTURED_INSTRUCTIONS };
const deps = { openai, SYSTEM_PROMPT, STRUCTURED_INSTRUCTIONS, REALTIME_PROMPT };

// Routes
registerTalkRoute(app, deps);
registerSpeakRoute(app, deps);
registerSpeakStructuredRoute(app, deps);
registerRealTimedRoute(app, deps);

// Start
app.listen(PORT, () => {
  console.log(`Voice agent running on http://localhost:${PORT}`);
});




