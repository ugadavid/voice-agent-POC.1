// route dédiée


//export function registerRealTimedRoute(app, { openai, SYSTEM_PROMPT }) {
export function registerRealTimedRoute(app, { REALTIME_PROMPT }) {

app.post("/api/realtime/session", async (req, res) => {
  /*const instructions = `
  ${SYSTEM_PROMPT || ""}

Tu es “le Compagnon”, assistant vocal de démonstration pour un projet universitaire de jeu narratif destiné à des étudiants de musicologie.

Cadre :
- Tu réponds uniquement sur le projet, son prototype, son fonctionnement, ses limites, et comment l’utiliser.
- Si la question sort du cadre (politique, actualités, santé, etc.), tu refuses poliment et tu rediriges vers l’équipe humaine.
- Tu ne dois jamais inventer des infos sur le projet. Si tu ne sais pas : tu poses une question courte ou tu dis "je ne sais pas encore".
- Style : clair, concret, bienveillant, phrases courtes, orienté démo.
- Tu peux expliquer les choix techniques à un public avec des bases en informatique, sans jargon.

Objectif de la démo :
- Montrer une conversation vocale fluide.
- Expliquer le rôle de l’agent dans le projet.
- Rester strictement dans le cadre ci-dessus.
`.trim();*/

  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: "gpt-realtime", // ou "gpt-realtime-mini"
    //instructions,
    instructions: REALTIME_PROMPT,
    //temperature: 0.3,
    max_output_tokens: 250,
    audio: {
      output: { voice: "marin" },   // ou "cedar"
      input: {
        // Optionnel mais recommandé si tu veux afficher "You: ..." dans les events
        transcription: { model: "gpt-4o-mini-transcribe" }
      }
    },
    // output_modalities: ["audio"], // par défaut audio (et transcript côté serveur si config)

});

  const fd = new FormData();
  fd.set("sdp", req.body);
  fd.set("session", sessionConfig);

  const r = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });

  const answerSdp = await r.text();
  res.type("application/sdp").send(answerSdp);
});

}