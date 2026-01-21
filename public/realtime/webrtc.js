// public/realtime/webrtc.js
import { rtState } from "./state.js";
import { logRT, ensureRemoteAudioEl, bindRemoteAudioStatus } from "./ui.js";
import { gateMicWhileAssistantPlays } from "./audioGate.js";

function sendEvent(type, payload = {}) {
  if (!rtState.dc || rtState.dc.readyState !== "open") return false;
  rtState.dc.send(JSON.stringify({ type, ...payload }));
  return true;
}

function bindDataChannel({ dom, setStatus, warmup, debug }) {
  rtState.dc.onopen = () => {
    if (debug) console.log("datachannel open");
    setStatus?.(dom, "realtime: connected");
  };

  rtState.dc.onclose = () => {
    if (debug) console.log("datachannel closed");
  };

  rtState.dc.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      if (debug) console.log("evt:", evt.type, evt);

      if (evt.type === "error") {
        console.error("REALTIME ERROR", evt.error);
        logRT(dom, `❌ error: ${evt?.error?.message || "unknown"}`);
        return;
      }

      if (evt.type === "session.created") {
        logRT(dom, "✅ session.created");

        if (warmup) {
          logRT(dom, "ℹ️ warmup…");
          sendEvent("conversation.item.create", {
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "Rappelle en 1 phrase à quel public le jeu est destiné." }],
            },
          });
          sendEvent("response.create");
        }
      }

      if (evt.type === "conversation.item.input_audio_transcription.completed") {
        const t = evt?.transcript;
        if (t) logRT(dom, `You: ${t}`);
      }

      if (evt.type === "response.output_text.delta") {
        const d = evt?.delta;
        if (!d) return;
        const el = dom?.transcriptrt;
        if (!el) return;

        if (!el.textContent.includes("Assistant:")) logRT(dom, "Assistant: ");
        el.textContent += d;
      }

      if (evt.type === "response.output_text.done") {
        const el = dom?.transcriptrt;
        if (el) el.textContent += "\n";
      }
    } catch {
      if (debug) console.log("evt(raw):", e.data);
    }
  };
}

export async function connectWebRTC({ dom, setStatus, warmup = false, debug = false } = {}) {
  setStatus?.(dom, "realtime: connecting…");

  rtState.pc = new RTCPeerConnection();

  if (debug) {
    rtState.pc.onconnectionstatechange = () => console.log("pc.connectionState =", rtState.pc.connectionState);
    rtState.pc.oniceconnectionstatechange = () => console.log("pc.iceConnectionState =", rtState.pc.iceConnectionState);
    rtState.pc.onicegatheringstatechange = () => console.log("pc.iceGatheringState =", rtState.pc.iceGatheringState);
    rtState.pc.onsignalingstatechange = () => console.log("pc.signalingState =", rtState.pc.signalingState);
  }

  rtState.dc = rtState.pc.createDataChannel("oai-events");
  bindDataChannel({ dom, setStatus, warmup, debug });

  // Micro
  rtState.localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  rtState.micTrack = rtState.localStream.getAudioTracks()[0] || null;
  if (rtState.micTrack) rtState.micTrack.enabled = false;

  rtState.localStream.getTracks().forEach((track) => rtState.pc.addTrack(track, rtState.localStream));

  // Audio entrant
  const audioEl = ensureRemoteAudioEl(dom);
  gateMicWhileAssistantPlays(audioEl);
  bindRemoteAudioStatus(audioEl, { dom, setStatus });

  rtState.pc.ontrack = (event) => {
    audioEl.srcObject = event.streams[0];
  };

  // SDP offer -> server -> answer
  const offer = await rtState.pc.createOffer();
  await rtState.pc.setLocalDescription(offer);

  const resp = await fetch("/api/realtime/session", {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: offer.sdp,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Realtime session error ${resp.status}: ${txt || resp.statusText}`);
  }

  const answerSdp = await resp.text();
  await rtState.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return true;
}

export function requestResponse() {
  sendEvent("response.create");
}
