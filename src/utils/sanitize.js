import { SCHEMA } from "../constants.js";

const intents = new Set(SCHEMA.ALLOWED_INTENTS);
const emotions = new Set(SCHEMA.ALLOWED_EMOTIONS);

export function sanitizeIntent(x) {
  return intents.has(x) ? x : "redirect_to_humans";
}

export function sanitizeEmotion(x) {
  return emotions.has(x) ? x : "neutral";
}
