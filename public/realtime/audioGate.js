// public/realtime/audioGate.js
import { rtState } from "./state.js";

export function setMicEnabled(enabled) {
  const t = rtState.micTrack;
  if (!t) return;
  try {
    t.enabled = !!enabled;
  } catch {}
}

export function gateMicWhileAssistantPlays(audioEl) {
  if (!audioEl) return;

  audioEl.addEventListener("play", () => {
    if (rtState.micGateTimer) clearTimeout(rtState.micGateTimer);
    setMicEnabled(false);
  });

  const reEnable = () => {
    if (rtState.micGateTimer) clearTimeout(rtState.micGateTimer);
    rtState.micGateTimer = setTimeout(() => setMicEnabled(true), 150);
  };

  audioEl.addEventListener("pause", reEnable);
  audioEl.addEventListener("ended", reEnable);
}
