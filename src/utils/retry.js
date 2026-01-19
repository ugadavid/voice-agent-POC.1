import { LIMITS } from "../constants.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withRetry(fn, { 
  tries = LIMITS.RETRY_TRIES,
  baseDelayMs = LIMITS.RETRY_BASE_DELAY_MS
} = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      const msg = String(err?.message || "");
      const causeCode = err?.cause?.code;

      const shouldRetry =
        msg.includes("Connection error") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        causeCode === "ECONNRESET" ||
        causeCode === "ETIMEDOUT";

      if (!shouldRetry || i === tries - 1) throw err;

      await sleep(baseDelayMs * Math.pow(2, i)); // 400, 800, 1600…
    }
  }
  throw lastErr;
}
