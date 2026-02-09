# Voice Agent POC — documentation (tech + fonctionnel)

> Projet : `voice-agent` (Node/Express) + UI de démo (HTML/JS)  
> Entrée : `/server.js`  
> Dossiers clés : `/src` (backend) et `/public` (frontend démo)

---

## 0) TL;DR architecture

Il y a **3 “modes”** exposés par le serveur :

1) **Talk** (audio → STT → LLM → TTS)  
`POST /api/talk` (multipart, fichier audio)

2) **Speak** (texte → LLM → TTS)  
`POST /api/speak` (JSON)

3) **Speak structured** (texte + mémoire locale → LLM (JSON) → (optionnel TTS))  
`POST /api/speak_structured` (JSON)

+ un **mode Realtime WebRTC** :
- client WebRTC dans `/public/realtime/*`
- serveur : `POST /api/realtime/session` (SDP offer → SDP answer via OpenAI Realtime)

+ un **mini RAG (WIP)** :
`GET /api/rag/search?q=...&k=...` (embedding + recherche pgvector)

---

## 1) Fonctionnel (ce que fait la démo)

### 1.1 UI de démo (frontend)
Dans `/public` :
- bouton micro “🎙️ Parler” : enregistre, envoie à `/api/talk`, affiche transcript + reply, joue le MP3.
- bouton “ask” : envoie du texte à `/api/speak`, joue le MP3.
- bouton “ask structured” : envoie du texte à `/api/speak_structured`, met à jour :
  - intent / emotion / confidence
  - avatar (image selon l’émotion)
  - joue le MP3 (sauf si `noAudio: true`).

### 1.2 Mémoire (côté navigateur)
- Stockée en `localStorage` (`companion_memory_v1`) via `/public/memory.js`
- Contient :
  - `turns`: liste de `{ role: "user"|"assistant", content }`
  - `summary`: string (prévu, mais pas encore alimenté automatiquement)
- Par défaut on garde ~12 messages (configurable dans `pushTurn` et cohérent avec `src/constants.js`).

### 1.3 Garde-fou “périmètre projet”
- `SYSTEM_PROMPT` + `STRUCTURED_INSTRUCTIONS` imposent :
  - répondre **uniquement** sur le projet/dispositif/agent
  - refuser le hors périmètre
  - cas particulier : les questions “meta” (mémoire / conversation / interface) restent **dans** le périmètre.

---

## 2) Backend — comment ça marche

### 2.1 Arborescence
- `server.js` : configure Express + middlewares + enregistre routes
- `src/routes/*` : endpoints API
- `src/prompts/*` : prompts
- `src/services/tts.js` : Text-to-Speech → MP3 base64
- `src/utils/*` : retry, erreurs, uploads, sanitation…
- `src/db.js` + `src/routes/ragSearch.js` : RAG (Postgres + pgvector)

### 2.2 Config & constantes
Dans `src/constants.js` :
- modèles :
  - CHAT: `gpt-4o-mini`
  - TRANSCRIBE: `gpt-4o-mini-transcribe`
  - TTS: `gpt-4o-mini-tts`
- limites mémoire : `MAX_TURNS`, `MAX_CONTENT_CHARS`
- schema intent/émotion autorisés

Dans `src/config.js` :
- `PORT` (défaut 5177)
- exige `OPENAI_API_KEY`

---

## 3) API (contrats d’interface)

### 3.1 POST /api/talk
**But** : audio → transcript + reply + MP3

- Request : `multipart/form-data`
  - champ `audio`: fichier (wav/webm/ogg selon MediaRecorder)
- Response JSON :
```json
{
  "transcript": "texte STT",
  "replyText": "texte assistant",
  "audioMp3Base64": "SUQz... (base64, sans data:)"
}
```

**Chaîne interne** :
1. `openai.audio.transcriptions.create({ model: gpt-4o-mini-transcribe })`
2. `openai.chat.completions.create({ model: gpt-4o-mini, messages:[system, user] })`
3. `openai.audio.speech.create({ model: gpt-4o-mini-tts, voice })` → MP3 → base64

### 3.2 POST /api/speak
**But** : texte → reply + MP3

- Request : JSON
```json
{ "text": "..." }
```
- Response : identique à `/api/talk` (transcript = input texte)

### 3.3 POST /api/speak_structured
**But** : texte + mémoire → JSON structuré (+ MP3 optionnel)

- Request : JSON
```json
{
  "text": "question utilisateur",
  "noAudio": false,
  "memory": {
    "summary": "optionnel",
    "turns": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
}
```

- Response JSON :
```json
{
  "intent": "meta_conversation",
  "emotion": "curious",
  "confidence": 0.74,
  "replyText": "…",
  "audioMp3Base64": "… ou null si noAudio"
}
```

Notes :
- Le modèle est forcé à produire du JSON via `response_format: { type: "json_object" }`.
- Sanitation : `sanitizeIntent`, `sanitizeEmotion` si valeurs non autorisées.

### 3.4 POST /api/realtime/session
**But** : établir une session Realtime via WebRTC (SDP offer → SDP answer)

- Request :
  - `Content-Type: application/sdp`
  - body = `offer.sdp` (string)
- Response :
  - `Content-Type: application/sdp`
  - body = `answer.sdp`

Le serveur relaie la création de session vers OpenAI Realtime (`/v1/realtime/calls`) avec :
- `model: "gpt-realtime"`
- `instructions: REALTIME_PROMPT`
- audio output voice (actuellement `"marin"`)
- transcription input via `gpt-4o-mini-transcribe`

### 3.5 GET /api/rag/search
**But** : recherche de chunks dans Postgres/pgvector

- Request :
  - `q` (string) requis
  - `k` (int, défaut 5, max 12)
- Response :
```json
{
  "chunks": [
    { "id": 1, "source": "...", "title": "...", "chunk_index": 0, "content": "...", "score": 0.83 }
  ]
}
```

---

## 4) Séquences (pour se remettre dedans vite)

### 4.1 Pipeline “classique”
```
Browser (MediaRecorder)
   └─ POST /api/talk (audio)
        ├─ STT (transcribe)
        ├─ Chat completion (replyText)
        └─ TTS (mp3 base64)
   └─ Browser joue MP3 + affiche transcript/reply
```

### 4.2 Pipeline “structured”
```
Browser
   └─ POST /api/speak_structured (text + memory)
        ├─ Chat completion (JSON strict)
        ├─ sanitize intent/emotion
        └─ (opt) TTS
   └─ Browser: met à jour avatar + affiche replyText
```

### 4.3 Realtime (WebRTC)
```
Browser: RTCPeerConnection + DataChannel
   └─ createOffer/SDP
   └─ POST /api/realtime/session (offer.sdp)
        └─ OpenAI realtime/calls -> answer.sdp
   └─ setRemoteDescription(answer)
   └─ (Push-to-talk) Space down: micTrack.enabled=true
   └─ Space up: micTrack.enabled=false + send "response.create" via datachannel
   └─ Browser reçoit audio + transcripts events
```

---

## 5) Lancer le projet (dev)

### 5.1 Prérequis
- Node récent (18+ recommandé pour `fetch`, `FormData` en global)
- `OPENAI_API_KEY` dans `.env`
- (optionnel RAG) Postgres + extension `pgvector` + `DATABASE_URL`

### 5.2 Commandes
```bash
npm install
npm run dev
# => http://localhost:5177
```

### 5.3 Variables d’env attendues
- `OPENAI_API_KEY` (obligatoire)
- `PORT` (optionnel)
- `DATABASE_URL` (optionnel, seulement pour RAG)

---

## 6) Architecture — comment on connecte à Storyline (plan concret)

### 6.1 Principe (recommandé)
👉 **Découpler** : Storyline = “orchestrateur UI/pédago”, notre agent = “service web”.
Le plus simple, stable et “propre Storyline” :

1) **Héberger** ce POC (au moins le backend) sur un domaine HTTPS.
2) Dans Storyline, intégrer un **Web Object** qui pointe vers une page HTML “bridge”.
3) Le bridge :
   - affiche / contrôle le micro (permissions navigateur)
   - parle au backend (`/api/*`)
   - renvoie à Storyline le texte / intent / émotion via `postMessage` ou via `player.SetVar()`.

Pourquoi Web Object ?
- Storyline seul est limité pour accéder au micro.
- Le Web Object tourne dans un contexte navigateur normal (donc getUserMedia OK, avec user gesture + HTTPS).

### 6.2 Deux patterns d’intégration

#### Pattern A — Web Object autonome (le plus simple)
- Storyline : 1 slide “Agent vocal” contenant le Web Object.
- Le Web Object gère tout (micro + UI + appels API).
- Storyline récupère uniquement :
  - dernier transcript
  - dernier replyText
  - intent/emotion/confidence
  - event “completed” (ex : l’étudiant a parlé → on passe à l’étape suivante)

✅ Avantages : rapide, moins fragile.  
⚠️ Inconvénient : UI partagée (Storyline + web) à harmoniser.

#### Pattern B — Storyline UI + “headless bridge”
- Storyline a ses boutons/avatars
- Le Web Object est quasi invisible, il n’est qu’un **pont JS** :
  - il capture le micro
  - il fait les fetch
  - il poste les résultats à Storyline

✅ Avantages : UI 100% Storyline  
⚠️ Inconvénient : plus de colle JS (et permissions micro à gérer finement).

### 6.3 Communication Storyline ↔ Web Object
Option 1 : `postMessage` (robuste cross-frame)
- Storyline → WebObject : `window.postMessage({type:"AGENT_START"}, "*")`
- WebObject → Storyline : `parent.postMessage({type:"AGENT_RESULT", payload:{...}}, "*")`
- Dans Storyline, un petit JS “listener” capte le message et remplit des variables.

Option 2 : `player.SetVar()` direct (si même origin / selon embedding)
- côté WebObject :
```js
const player = window.parent.GetPlayer?.();
player?.SetVar("agent_reply", replyText);
```
(Parfois Storyline encapsule ; `postMessage` reste plus universel.)

### 6.4 Quel endpoint choisir pour Storyline ?
- **Démo “à la demande”** (bouton parler → réponse) : `/api/talk` ou `/api/speak_structured` + TTS
- **Jeu narratif fluide** : Realtime WebRTC (latence + naturel)
  - en pratique : on démarre la session à l’arrivée sur la slide
  - push-to-talk via bouton Storyline (ou barre espace dans le WebObject)

### 6.5 Point d’attention “prod”
- Micro : nécessite **HTTPS** + interaction utilisateur.
- CORS : si Storyline et backend sont sur des domaines différents, prévoir headers CORS.
- Token : ne jamais exposer la clé OpenAI côté client. Ici c’est OK (clé côté serveur).

---

## 7) “Next steps” (aujourd’hui vs demain)

### Aujourd’hui (docs + architecture)
1) Écrire une page “README proper” :
   - install
   - endpoints
   - comment tester
2) Dessiner 2 schémas (classique vs realtime)
3) Choisir Pattern Storyline (A ou B) + écrire un “bridge.html” minimal

### Demain (RAG / base vectorielle)
1) Stabiliser schema DB `documents` + `chunks` + ingestion
2) Ajouter un endpoint “answer_with_rag” :
   - recherche top-k
   - injection des chunks dans le prompt
   - traçabilité (sources)
3) Ajouter un “summary” automatique côté front (ou côté backend)

