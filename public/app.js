const btn = document.getElementById("btn");
const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const replyEl = document.getElementById("reply");
const player = document.getElementById("player");

let mediaRecorder = null;
let chunks = [];
let stream = null;
let isRecording = false;

function setStatus(s) {
  statusEl.textContent = s;
}

function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// ===== Memory (client-side) =====
const MEM_KEY = "companion_memory_v1";

function loadMemory() {
  try {
    return JSON.parse(localStorage.getItem(MEM_KEY)) || { turns: [], summary: "" };
  } catch {
    return { turns: [], summary: "" };
  }
}

function saveMemory(mem) {
  localStorage.setItem(MEM_KEY, JSON.stringify(mem));
}

function resetMemory() {
  localStorage.removeItem(MEM_KEY);
}

function pushTurn(role, content) {
  const mem = loadMemory();
  mem.turns.push({ role, content });

  // Keep last 12 messages (6 turns user/assistant)
  const MAX_MSG = 12;
  if (mem.turns.length > MAX_MSG) mem.turns = mem.turns.slice(-MAX_MSG);

  saveMemory(mem);
  return mem;
}



async function startRecording() {
  transcriptEl.textContent = "—";
  replyEl.textContent = "—";
  player.removeAttribute("src");
  player.load();

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Most browsers support webm/opus. If not, it will fallback.
  const candidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",               // parfois meilleur selon OS
];

let chosen = "";
for (const t of candidates) {
  if (MediaRecorder.isTypeSupported(t)) { chosen = t; break; }
}

mediaRecorder = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined);
console.log("MediaRecorder mimeType:", mediaRecorder.mimeType);


  chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    try {
      setStatus("uploading…");
      btn.disabled = true;

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      const blobType = (blob.type || "").toLowerCase();

      // Déterminer une extension cohérente
      let ext = "webm";
      if (blobType.includes("mp4")) ext = "mp4";
      else if (blobType.includes("wav")) ext = "wav";
      else if (blobType.includes("mpeg")) ext = "mp3";
      else if (blobType.includes("webm")) ext = "webm";

      const filename = `recording.${ext}`;

      console.log("Recorded blob type:", blob.type, "size:", blob.size);

      const form = new FormData();
      form.append("audio", blob, filename);


      /**
       * /api/talk
       */
      const resp = await fetch("/api/talk", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Server error");



      transcriptEl.textContent = data.transcript || "(vide)";
      replyEl.textContent = data.replyText || "(vide)";

      const audioBlob = base64ToBlob(data.audioMp3Base64, "audio/mpeg");
      const audioUrl = URL.createObjectURL(audioBlob);
      player.src = audioUrl;

      setStatus("playing");
      await player.play().catch(() => { /* user gesture sometimes required */ });
    } catch (err) {
      console.error(err);
      setStatus("error (voir console)");
    } finally {
      btn.disabled = false;
      setStatus("idle");
    }
  };

  mediaRecorder.start();
  isRecording = true;
  setStatus("recording…");
  btn.textContent = "⏹️ Stop";
}

async function stopRecording() {
  if (!mediaRecorder) return;

  mediaRecorder.stop();
  isRecording = false;
  setStatus("processing…");
  btn.textContent = "🎙️ Parler";

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

btn.addEventListener("click", async () => {
  if (!isRecording) {
    await startRecording();
  } else {
    await stopRecording();
  }
});



/**
 * /api/speak
 */
document.getElementById("ask").addEventListener("click", async () => {
  try {
    setStatus("asking…");
    const text = document.getElementById("q").value || "";
    const resp = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Server error");

    replyEl.textContent = data.replyText || "(vide)";
    const audioBlob = base64ToBlob(data.audioMp3Base64, "audio/mpeg");
    player.src = URL.createObjectURL(audioBlob);
    setStatus("playing");
    await player.play().catch(() => {});
  } catch (e) {
    console.error(e);
    setStatus("error (voir console)");
  } finally {
    setStatus("idle");
  }
});









/**
 * Gestion des émotions
 */
const avatar = document.getElementById("avatar");
const intentPill = document.getElementById("intentPill");
const emotionPill = document.getElementById("emotionPill");
const confPill = document.getElementById("confPill");

const emotionToAvatar = {
  neutral: "./avatars/neutral.png",
  happy: "./avatars/happy.png",
  curious: "./avatars/curious.png",
  concerned: "./avatars/concerned.png",
  confident: "./avatars/confident.png",
  apologetic: "./avatars/apologetic.png",
  playful: "./avatars/playful.png"
};

/**
 * /api/speak_structured
 */
document.getElementById("ask2").addEventListener("click", async () => {
  try {
    setStatus("asking…");

    const text = document.getElementById("q2").value || "";

    /**
     * mémoire
     */
    const mem = loadMemory();
    const payload = {
      text,
      memory: {
        summary: mem.summary || "",
        turns: mem.turns || []
      }
    };


    const resp = await fetch("/api/speak_structured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      //body: JSON.stringify({ text })
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Server error");

    // UI: badges
    intentPill.textContent = `intent: ${data.intent || "—"}`;
    emotionPill.textContent = `emotion: ${data.emotion || "—"}`;
    confPill.textContent = `conf: ${typeof data.confidence === "number" ? data.confidence.toFixed(2) : "—"}`;

    // UI: avatar
    const emo = data.emotion || "neutral";
    avatar.src = emotionToAvatar[emo] || emotionToAvatar.neutral;

    // Text box reuse
    replyEl.textContent = data.replyText || "(vide)";
    
    pushTurn("user", text);
    pushTurn("assistant", data.replyText || "");


    // Audio
    const audioBlob = base64ToBlob(data.audioMp3Base64, "audio/mpeg");
    player.src = URL.createObjectURL(audioBlob);

    setStatus("playing");
    await player.play().catch(() => {});
  } catch (e) {
    console.error(e);
    setStatus("error (voir console)");
  } finally {
    setStatus("idle");
  }
});


/**
 * Bouton reset
 */
document.getElementById("resetConv").addEventListener("click", () => {
  resetMemory();

  // reset UI (optionnel)
  replyEl.textContent = "—";
  intentPill.textContent = "intent: —";
  emotionPill.textContent = "emotion: —";
  confPill.textContent = "conf: —";
  avatar.src = "./avatars/neutral.png";
});
