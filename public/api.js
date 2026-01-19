async function readJsonOrThrow(resp) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "Server error");
  return data;
}

export async function apiTalk(formData) {
  const resp = await fetch("/api/talk", { method: "POST", body: formData });
  return readJsonOrThrow(resp);
}

export async function apiSpeak(text) {
  const resp = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return readJsonOrThrow(resp);
}

export async function apiSpeakStructured(text, memory) {
  const resp = await fetch("/api/speak_structured", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, memory }),
  });
  return readJsonOrThrow(resp);
}
