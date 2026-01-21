// public/realtime/ui.js
import { rtState } from "./state.js";

export function logRT(dom, line) {
  const el = dom?.transcriptrt;
  if (!el) return;

  const prev = el.textContent && el.textContent !== "—" ? el.textContent : "";
  el.textContent = prev ? `${prev}\n${line}` : line;
}

export function ensureRemoteAudioEl(dom) {
  if (rtState.remoteAudioEl) return rtState.remoteAudioEl;

  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  audioEl.controls = true;
  audioEl.style.width = "100%";
  audioEl.style.marginTop = "8px";

  const card = dom?.realTime?.closest?.(".card");
  (card || document.body).appendChild(audioEl);

  rtState.remoteAudioEl = audioEl;
  return audioEl;
}

export function bindRemoteAudioStatus(audioEl, { dom, setStatus }) {
  audioEl.addEventListener("play", () => setStatus?.(dom, "realtime: 🔊 assistant speaking…"));
  audioEl.addEventListener("pause", () => setStatus?.(dom, "realtime: idle"));
  audioEl.addEventListener("ended", () => setStatus?.(dom, "realtime: idle"));
}
