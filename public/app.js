import { getDom, setStatus } from "./dom.js";
import { setPlayerFromMp3Base64 } from "./audio.js";
import { loadMemory, pushTurn, resetMemory } from "./memory.js";
import { apiTalk, apiSpeak, apiSpeakStructured } from "./api.js";
import { updateStructuredUI, resetStructuredUI } from "./avatar.js";
import { toggleRecording, isRecording } from "./recorder.js";
//import { connectRealtime, disconnectRealtime, isRealtimeConnected } from "./realtime.js";
import { connectRealtime, disconnectRealtime, isRealtimeConnected, realtimeStartTalking, realtimeStopTalkingAndRespond } from "./realtime.js";


/**
 * /public/app.js
 */

const dom = getDom();

function resetPlayerAndText() {
  dom.transcriptEl.textContent = "—";
  dom.replyEl.textContent = "—";
  dom.player.removeAttribute("src");
  dom.player.load();
}

// ===== Button bindings =====

// Micro (MediaRecorder externalisé dans recorder.js)
dom.btn.addEventListener("click", async () => {
  // Pure cosmétique : si on était en train d'enregistrer, on affiche "processing…" dès le clic stop
  const wasRecording = isRecording();
  if (wasRecording) {
    setStatus(dom, "processing…");
    dom.btn.textContent = "🎙️ Parler";
  }

  await toggleRecording({
    onStart: () => {
      resetPlayerAndText();
      setStatus(dom, "recording…");
      dom.btn.textContent = "⏹️ Stop";
    },

    onStop: async ({ formData }) => {
      try {
        setStatus(dom, "uploading…");
        dom.btn.disabled = true;

        const data = await apiTalk(formData);

        dom.transcriptEl.textContent = data.transcript || "(vide)";
        dom.replyEl.textContent = data.replyText || "(vide)";

        if (data.audioMp3Base64) {
          setPlayerFromMp3Base64(dom.player, data.audioMp3Base64);
          setStatus(dom, "playing");
          await dom.player.play().catch(() => {});
        } else {
          setStatus(dom, "idle");
        }
      } catch (err) {
        console.error(err);
        setStatus(dom, "error (voir console)");
      } finally {
        dom.btn.disabled = false;
        dom.btn.textContent = "🎙️ Parler";
        if (dom.statusEl.textContent !== "error (voir console)") {
          setStatus(dom, "idle");
        }
      }
    },

    onError: (err) => {
      console.error(err);
      setStatus(dom, "error (voir console)");
      dom.btn.textContent = "🎙️ Parler";
    },
  });
});

// /api/speak
dom.askBtn.addEventListener("click", async () => {
  try {
    setStatus(dom, "asking…");
    const text = dom.qInput.value || "";

    const data = await apiSpeak(text);

    dom.replyEl.textContent = data.replyText || "(vide)";
    if (data.audioMp3Base64) setPlayerFromMp3Base64(dom.player, data.audioMp3Base64);

    setStatus(dom, "playing");
    await dom.player.play().catch(() => {});
  } catch (e) {
    console.error(e);
    setStatus(dom, "error (voir console)");
  } finally {
    setStatus(dom, "idle");
  }
});

// /api/speak_structured
dom.ask2Btn.addEventListener("click", async () => {
  try {
    setStatus(dom, "asking…");
    const text = dom.q2Input.value || "";

    const mem = loadMemory();
    const data = await apiSpeakStructured(text, {
      summary: mem.summary || "",
      turns: mem.turns || [],
    });

    updateStructuredUI(dom, data);
    dom.replyEl.textContent = data.replyText || "(vide)";

    pushTurn("user", text);
    pushTurn("assistant", data.replyText || "");

    if (data.audioMp3Base64) setPlayerFromMp3Base64(dom.player, data.audioMp3Base64);

    setStatus(dom, "playing");
    await dom.player.play().catch(() => {});
  } catch (e) {
    console.error(e);
    setStatus(dom, "error (voir console)");
  } finally {
    setStatus(dom, "idle");
  }
});

// reset
dom.resetBtn.addEventListener("click", () => {
  resetMemory();
  dom.replyEl.textContent = "—";
  resetStructuredUI(dom);
});





// ===== POC2: Realtime =====
dom.realTime.addEventListener("click", async () => {
  try {
    // Optionnel : si tu veux que le bouton fasse toggle connect/disconnect
    if (isRealtimeConnected()) {
      await disconnectRealtime();
      setStatus(dom, "realtime: disconnected");
      rtSetText("—");
      rtToggleBtnTxt("Real Time GPT+");
      return;
    } else {
      rtToggleBtnTxt("Real Time GPT+ ready...");
    }

    //await connectRealtime({ dom, setStatus, warmup: true, debug: true });
    await connectRealtime({ dom, setStatus, warmup: false, debug: true });
  } catch (e) {
    console.error(e);
    setStatus(dom, "realtime: error (voir console)");
    await disconnectRealtime();
    rtSetText("—");
  }
});


function setPTTBadge(on) {
  if (!dom.statusEl) return;
  dom.statusEl.dataset.ptt = on ? "1" : "0";
}



let spaceDown = false;

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (!isRealtimeConnected()) return;
  if (spaceDown) return;

  spaceDown = true;
  realtimeStartTalking();
  setPTTBadge(true);
  beep(880, 50);
  setStatus(dom, "realtime: 🎙️ REC (hold space)");
  e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;
  if (!isRealtimeConnected()) return;

  spaceDown = false;
  setPTTBadge(false);
  beep(660, 50);
  realtimeStopTalkingAndRespond();
  setStatus(dom, "realtime: 🤖 thinking…");
  e.preventDefault();
});


let audioCtx = null;
function beep(freq = 880, ms = 50) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = 0.03; // discret
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      o.disconnect();
      g.disconnect();
    }, ms);
  } catch {}
}

function rtSetText(txt) {
  if (dom.transcriptrt) dom.transcriptrt.textContent = txt || "—";
}


function rtToggleBtnTxt(txt) {
  if (!dom.realTime) return;
  dom.realTime.textContent = txt;
}

