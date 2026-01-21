// public/realtime.js
import { rtState, isConnected, resetState } from "./realtime/state.js";
import { connectWebRTC, requestResponse } from "./realtime/webrtc.js";
import { setMicEnabled } from "./realtime/audioGate.js";

export function isRealtimeConnected() {
  return isConnected();
}

export async function disconnectRealtime() {
  try {
    if (rtState.dc && rtState.dc.readyState === "open") rtState.dc.close();
  } catch {}

  try {
    if (rtState.pc) rtState.pc.close();
  } catch {}

  if (rtState.localStream) {
    rtState.localStream.getTracks().forEach((t) => t.stop());
  }

  if (rtState.remoteAudioEl) {
    rtState.remoteAudioEl.pause();
    rtState.remoteAudioEl.srcObject = null;
  }

  resetState();
}

export async function connectRealtime(opts = {}) {
  await disconnectRealtime();
  try {
    return await connectWebRTC(opts);
  } catch (e) {
    await disconnectRealtime();
    throw e;
  }
}

export function realtimeStartTalking() {
  setMicEnabled(true);
}

export function realtimeStopTalkingAndRespond() {
  setMicEnabled(false);
  requestResponse();
}
