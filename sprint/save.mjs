const suffix = "-reaction-v1";
function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
export function readEventSave(key) {
  const current = read(key + suffix);
  if (current && typeof current === "object") return current;
  const legacy = read(key + "-manual-flame-v1-sport-v1") ?? read(key + "-manual-flame-v1") ?? read(key + "-rivals-v1") ?? read(key + "-long-zones-v1") ?? read(key);
  return { loadout: legacy?.loadout, barHeight: legacy?.barHeight, best: null };
}
export function writeEventSave(key, value) {
  try { localStorage.setItem(key + suffix, JSON.stringify(value)); } catch {}
}
