// public/realtime/state.js
export const rtState = {
  pc: null,
  dc: null,
  localStream: null,
  remoteAudioEl: null,
  micTrack: null,
  micGateTimer: null,
};

export function isConnected() {
  const pc = rtState.pc;
  return !!pc && (pc.connectionState === "connecting" || pc.connectionState === "connected");
}

export function resetState() {
  rtState.pc = null;
  rtState.dc = null;
  rtState.localStream = null;
  rtState.remoteAudioEl = null;
  rtState.micTrack = null;
  if (rtState.micGateTimer) {
    clearTimeout(rtState.micGateTimer);
    rtState.micGateTimer = null;
  }
}
