// public/realtime.js

/**
 * Realtime (WebRTC) – POC2
 * - Connecte une session Realtime via /api/realtime/session (SDP offer/answer)
 * - Injecte des instructions projet (contexte) via session.update
 * - Optionnel : envoie un warmup + response.create pour valider que ça parle bien
 */

let pc = null;
let dc = null;
let localStream = null;
let remoteAudioEl = null;
let micTrack = null;
let micGateTimer = null;

function rtAppend(dom, line) {
  const el = dom?.transcriptrt;
  if (!el) return;
  const prev = el.textContent && el.textContent !== "—" ? el.textContent : "";
  el.textContent = prev ? `${prev}\n${line}` : line;
}

function rtEnsureHeader(dom) {
  const el = dom?.transcriptrt;
  if (!el) return;
  if (!el.textContent || el.textContent === "—") {
    el.textContent = "Realtime log:";
  }
}


function buildRealtimeInstructions() {
  return `
Tu es “le Compagnon”, assistant vocal de démonstration pour un projet universitaire de jeu narratif destiné à des étudiants de musicologie.

Cadre :
- Tu réponds uniquement sur le projet, son prototype, son fonctionnement, ses limites, et comment l’utiliser.
- Si la question sort du cadre (politique, actualités, santé, etc.), tu refuses poliment et tu rediriges vers l’équipe humaine.
- Tu ne dois jamais inventer des infos sur le projet. Si tu ne sais pas : tu poses une question courte ou tu dis "je ne sais pas encore".
- Style : clair, concret, bienveillant, phrases courtes, orienté démo.
- Tu peux expliquer les choix techniques à un public avec des bases en informatique, sans jargon.

Objectif de la démo :
- Montrer une conversation vocale fluide.
- Expliquer le rôle de l’agent dans le projet.
- Rester strictement dans le cadre ci-dessus.
`.trim();
}

function ensureRemoteAudioEl(dom) {
  if (remoteAudioEl) return remoteAudioEl;

  remoteAudioEl = document.createElement("audio");
  remoteAudioEl.autoplay = true;
  remoteAudioEl.controls = true; // utile en debug
  remoteAudioEl.style.width = "100%";
  remoteAudioEl.style.marginTop = "8px";

  // On l’accroche dans la card “Real time” si possible, sinon en fin de body
  const card = dom?.realTime?.closest?.(".card");
  (card || document.body).appendChild(remoteAudioEl);

  return remoteAudioEl;
}


function setMicEnabled(enabled) {
  if (!micTrack) return;
  try {
    micTrack.enabled = !!enabled;
  } catch {}
}

function gateMicWhileAssistantPlays(audioEl) {
  if (!audioEl) return;

  // Quand l’assistant parle, on coupe le micro pour éviter la boucle d’écho (source majeure d’interruptions).
  audioEl.addEventListener("play", () => {
    if (micGateTimer) clearTimeout(micGateTimer);
    setMicEnabled(false);
  });

  const reEnable = () => {
    if (micGateTimer) clearTimeout(micGateTimer);
    micGateTimer = setTimeout(() => setMicEnabled(true), 150);
  };

  audioEl.addEventListener("pause", reEnable);
  audioEl.addEventListener("ended", reEnable);
  audioEl.addEventListener("play", () => setStatus?.(dom, "realtime: 🔊 assistant speaking…"));
  audioEl.addEventListener("ended", () => setStatus?.(dom, "realtime: idle"));
  audioEl.addEventListener("pause", () => setStatus?.(dom, "realtime: idle"));


}

function sendSessionUpdate() {
  if (!dc || dc.readyState !== "open") return;

  const instructions = buildRealtimeInstructions();

  dc.send(
    JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        instructions,
      },

      // voice: "alloy", // optionnel (attention: modifiable seulement avant les premiers outputs audio)
    })
  );
}

function sendWarmupAndRespond() {
  if (!dc || dc.readyState !== "open") return;

  // Message d’amorçage : vérifie que le contexte est bien pris
  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            //text: "Présente-toi en 1 phrase et rappelle ton cadre d’intervention.",
            text: "Peux tu rappeler à quel public le jeu narratif est destiné stp ?",
          },
        ],
      },
    })
  );

  // Demande une réponse
  dc.send(JSON.stringify({ type: "response.create" }));
}

/**
 * Retourne true si une connexion est en cours / établie (approx).
 */
export function isRealtimeConnected() {
  return !!pc && (pc.connectionState === "connecting" || pc.connectionState === "connected");
}

/**
 * Ferme proprement la session.
 */
export async function disconnectRealtime() {
  try {
    if (dc && dc.readyState === "open") dc.close();
  } catch {}

  try {
    if (pc) pc.close();
  } catch {}

  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  micTrack = null;
  if (micGateTimer) {
    clearTimeout(micGateTimer);
    micGateTimer = null;
  }

  if (remoteAudioEl) {
    remoteAudioEl.pause();
    remoteAudioEl.srcObject = null;
    // tu peux le garder visible (debug) ou le virer :
    // remoteAudioEl.remove();
    // remoteAudioEl = null;
  }

  pc = null;
  dc = null;
}

/**
 * Connecte la session realtime.
 * @param {object} opts
 * @param {object} opts.dom - objet retourné par getDom()
 * @param {(dom, status:string) => void} opts.setStatus - helper UI
 * @param {boolean} [opts.warmup=true] - envoie le warmup + response.create
 * @param {boolean} [opts.debug=true] - logs WebRTC
 */
export async function connectRealtime({ dom, setStatus, warmup = true, debug = true } = {}) {
  // Si on clique plusieurs fois : on repart propre
  await disconnectRealtime();

  setStatus?.(dom, "realtime: connecting…");

  pc = new RTCPeerConnection();

  if (debug) {
    pc.onconnectionstatechange = () => console.log("pc.connectionState =", pc.connectionState);
    pc.oniceconnectionstatechange = () => console.log("pc.iceConnectionState =", pc.iceConnectionState);
    pc.onicegatheringstatechange = () => console.log("pc.iceGatheringState =", pc.iceGatheringState);
    pc.onsignalingstatechange = () => console.log("pc.signalingState =", pc.signalingState);
  }

  // Data channel
  dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    if (debug) console.log("datachannel open");
    setStatus?.(dom, "realtime: connected");

    // 1) injecter contexte
    //sendSessionUpdate();

    // 2) amorçage optionnel
    //if (warmup) sendWarmupAndRespond();
  };



  let didUpdate = false;
  let didWarmup = false;

  dc.onmessage = (e) => {
    //if (!debug) return;

    try {
      const evt = JSON.parse(e.data);
      //console.log("evt:", evt.type, evt);

      if (debug) console.log("evt:", evt.type, evt);

      if (evt.type === "session.created" && !didUpdate) {
        didUpdate = true;
        sendSessionUpdate(); // instructions ici
      }

      if (evt.type === "session.updated" && warmup && !didWarmup) {
        didWarmup = true;
        sendWarmupAndRespond(); // warmup ici
      }

      if (evt.type === "error") {
        console.error("REALTIME ERROR", evt.error);
      }

      
      // Petit log lisible dans le <pre>
      if (evt.type === "session.created") {
        rtEnsureHeader(dom);
        rtAppend(dom, "✅ session.created");
      }

      if (evt.type === "session.updated") {
        rtAppend(dom, "✅ session.updated");
      }

      // Transcription user (si activée côté modèle — selon config, ça peut ne jamais arriver)
      if (evt.type === "conversation.item.input_audio_transcription.completed") {
        const t = evt?.transcript;
        if (t) rtAppend(dom, `You: ${t}`);
      }

      // Texte assistant (selon config, peut ne pas arriver si audio-only)
      if (evt.type === "response.output_text.delta") {
        const d = evt?.delta;
        if (d) {
          // accumulate sur la dernière ligne "Assistant: ..."
          const el = dom?.transcriptrt;
          if (el) {
            if (!el.textContent.includes("Assistant:")) rtAppend(dom, "Assistant: ");
            el.textContent += d;
          }
        }
      }
      if (evt.type === "response.output_text.done") {
        const el = dom?.transcriptrt;
        if (el) el.textContent += "\n";
      }




    } catch {
      //console.log("evt(raw):", e.data);
      if (debug) console.log("evt(raw):", e.data);
    }
  };



  dc.onclose = () => {
    if (debug) console.log("datachannel closed");
  };

  // Audio sortant (micro)
  localStream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }
  });
  micTrack = localStream.getAudioTracks()[0] || null;
  if (micTrack) micTrack.enabled = false;

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Audio entrant (voix modèle)
  const audioEl = ensureRemoteAudioEl(dom);
  gateMicWhileAssistantPlays(audioEl);

  audioEl.addEventListener("play", () => {
    setStatus?.(dom, "realtime: 🔊 assistant speaking…");
  });
  audioEl.addEventListener("ended", () => {
    setStatus?.(dom, "realtime: idle");
  });
  audioEl.addEventListener("pause", () => {
    setStatus?.(dom, "realtime: idle");
  });

  pc.ontrack = (event) => {
    audioEl.srcObject = event.streams[0];
  };

  // SDP offer -> server -> answer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const resp = await fetch("/api/realtime/session", {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: offer.sdp,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    await disconnectRealtime();
    throw new Error(`Realtime session error ${resp.status}: ${txt || resp.statusText}`);
  }

  const answerSdp = await resp.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return true;
}



export function realtimeStartTalking() {
  // on autorise le micro (il est streamé en continu via WebRTC)
  if (micTrack) micTrack.enabled = true;
}

export function realtimeStopTalkingAndRespond() {
  // on coupe le micro pour éviter l’écho / VAD parasite
  if (micTrack) micTrack.enabled = false;

  // et on déclenche une réponse
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify({ type: "response.create" }));
  }
}

function safeAppendLine(el, line) {
  if (!el) return;
  const prev = el.textContent || "";
  el.transcriptrt = (prev ? prev + "\n" : "") + line;
}
