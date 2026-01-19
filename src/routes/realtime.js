// route dédiée


export function registerRealTimedRoute(app, { openai, SYSTEM_PROMPT }) {

app.post("/api/realtime/session", async (req, res) => {
  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: "gpt-realtime",                 // ou "gpt-realtime-mini" (moins cher)
    audio: { output: { voice: "marin" } }, // marin/cedar recommandées  alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar...
    // output_modalities: ["audio"],        // optionnel (audio par défaut)
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