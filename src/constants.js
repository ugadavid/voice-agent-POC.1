// ===============================
// OpenAI models & audio
// ===============================

export const MODELS = {
  CHAT: "gpt-4o-mini",
  TRANSCRIBE: "gpt-4o-mini-transcribe",
  TTS: "gpt-4o-mini-tts",
};

export const VOICES = {
  DEFAULT: "alloy",
  // future voices can go here
};

// ===============================
// Conversation & memory limits
// ===============================

export const MEMORY = {
  MAX_TURNS: 12,          // 6 user/assistant turns
  MAX_CONTENT_CHARS: 2000
};

// ===============================
// API & server limits
// ===============================

export const LIMITS = {
  JSON_BODY_MB: "1mb",
  RETRY_TRIES: 3,
  RETRY_BASE_DELAY_MS: 400
};

// ===============================
// Defaults / fallbacks
// ===============================

export const DEFAULTS = {
  FALLBACK_USER_PROMPT: "Présente le projet en quelques phrases.",
  FALLBACK_REPLY: "D’accord."
};


export const PATHS = {
  UPLOAD_DIR: "tmp_uploads",
};



export const SCHEMA = {
  ALLOWED_INTENTS: [
    "greet",
    "explain_project",
    "answer_about_device",
    "meta_conversation",
    "clarify_question",
    "refuse_out_of_scope",
    "redirect_to_humans",
  ],
  ALLOWED_EMOTIONS: [
    "neutral",
    "happy",
    "curious",
    "concerned",
    "confident",
    "apologetic",
    "playful",
  ],
};
