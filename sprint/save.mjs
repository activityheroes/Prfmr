const suffix = "-manual-flame-v1";
const eventSuffix = key => /dot-(cycling|swimming)-/.test(key) ? suffix + "-sport-v1" : suffix;
function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
export function readEventSave(key) {
  const current = read(key + eventSuffix(key));
  if (current && typeof current === "object") return current;
  const legacy = read(key + suffix) ?? read(key + "-rivals-v1") ?? read(key + "-long-zones-v1") ?? read(key);
  return { loadout: legacy?.loadout, barHeight: legacy?.barHeight, best: null };
}
export function writeEventSave(key, value) {
  try { localStorage.setItem(key + eventSuffix(key), JSON.stringify(value)); } catch {}
}
