// public/recorder.js

let mediaRecorder = null;
let chunks = [];
let stream = null;
let recording = false;

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function extensionFromBlobType(blobType) {
  const t = (blobType || "").toLowerCase();
  if (t.includes("mp4")) return "mp4";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg")) return "mp3";
  return "webm";
}

export function isRecording() {
  return recording;
}

export async function startRecording({ onStart, onStop, onError } = {}) {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const chosen = pickMimeType();
    mediaRecorder = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined);
    console.log("MediaRecorder mimeType:", mediaRecorder.mimeType);

    chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const ext = extensionFromBlobType(blob.type);

        const form = new FormData();
        form.append("audio", blob, `recording.${ext}`);

        onStop?.({ formData: form, blob, ext, mimeType: blob.type });
      } catch (err) {
        onError?.(err);
      } finally {
        // cleanup stream
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
        }
      }
    };

    mediaRecorder.start();
    recording = true;
    onStart?.({ mimeType: mediaRecorder.mimeType });
  } catch (err) {
    onError?.(err);
  }
}

export function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  recording = false;

  // onstop will stop tracks
}

export async function toggleRecording(handlers = {}) {
  if (!recording) {
    await startRecording(handlers);
  } else {
    stopRecording();
  }
}
