const emotionToAvatar = {
  neutral: "./avatars/neutral.png",
  happy: "./avatars/happy.png",
  curious: "./avatars/curious.png",
  concerned: "./avatars/concerned.png",
  confident: "./avatars/confident.png",
  apologetic: "./avatars/apologetic.png",
  playful: "./avatars/playful.png",
};

export function updateStructuredUI(dom, data) {
  dom.intentPill.textContent = `intent: ${data.intent || "—"}`;
  dom.emotionPill.textContent = `emotion: ${data.emotion || "—"}`;
  dom.confPill.textContent = `conf: ${
    typeof data.confidence === "number" ? data.confidence.toFixed(2) : "—"
  }`;

  const emo = data.emotion || "neutral";
  dom.avatar.src = emotionToAvatar[emo] || emotionToAvatar.neutral;
}

export function resetStructuredUI(dom) {
  dom.intentPill.textContent = "intent: —";
  dom.emotionPill.textContent = "emotion: —";
  dom.confPill.textContent = "conf: —";
  dom.avatar.src = emotionToAvatar.neutral;
}
