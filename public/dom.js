export function getDom() {
  return {
    btn: document.getElementById("btn"),
    statusEl: document.getElementById("status"),
    transcriptEl: document.getElementById("transcript"),
    replyEl: document.getElementById("reply"),
    player: document.getElementById("player"),

    askBtn: document.getElementById("ask"),
    qInput: document.getElementById("q"),

    ask2Btn: document.getElementById("ask2"),
    q2Input: document.getElementById("q2"),

    resetBtn: document.getElementById("resetConv"),

    avatar: document.getElementById("avatar"),
    intentPill: document.getElementById("intentPill"),
    emotionPill: document.getElementById("emotionPill"),
    confPill: document.getElementById("confPill"),

    realTime: document.getElementById("realTime"),
    transcriptrt: document.getElementById("transcriptrt"),
  };
}

export function setStatus(dom, s) {
  dom.statusEl.textContent = s;
}
