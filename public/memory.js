const MEM_KEY = "companion_memory_v1";

export function loadMemory() {
  try {
    return JSON.parse(localStorage.getItem(MEM_KEY)) || { turns: [], summary: "" };
  } catch {
    return { turns: [], summary: "" };
  }
}

export function saveMemory(mem) {
  localStorage.setItem(MEM_KEY, JSON.stringify(mem));
}

export function resetMemory() {
  localStorage.removeItem(MEM_KEY);
}

export function pushTurn(role, content, { maxMessages = 12 } = {}) {
  const mem = loadMemory();
  mem.turns.push({ role, content });

  if (mem.turns.length > maxMessages) mem.turns = mem.turns.slice(-maxMessages);

  saveMemory(mem);
  return mem;
}
