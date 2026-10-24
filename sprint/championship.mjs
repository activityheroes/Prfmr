export const MEETS = {
  summer: { name: "Summer Circuit", events: ["sprint", "long-jump", "hurdles"] },
  winter: { name: "Winter Circuit", events: ["speed-skating", "ski-jumping", "biathlon"] },
  power: { name: "Power Circuit", events: ["javelin", "pole-vault", "high-jump"] },
  speed: { name: "Speed Circuit", events: ["sprint", "cycling", "swimming"] }
};
export const EVENTS = {
  sprint: { name: "100m Sprint", target: 10.5 }, cycling: { name: "200m Cycling", target: 12 },
  swimming: { name: "50m Swimming", target: 24 }, hurdles: { name: "100m Hurdles", target: 13.5 },
  "speed-skating": { name: "500m Speed Skating", target: 39 }, biathlon: { name: "400m Biathlon", target: 48 },
  javelin: { name: "Javelin", target: 65, field: true }, "long-jump": { name: "Long Jump", target: 8, field: true },
  "pole-vault": { name: "Pole Vault", target: 4, field: true }, "high-jump": { name: "High Jump", target: 1.8, field: true },
  "ski-jumping": { name: "Ski Jumping", target: 100, field: true }
};
const KEY = "dot-championship-v1";
export function eventPoints(id, result) {
  const event = EVENTS[id], value = event?.field ? result?.mark : result?.time;
  if (!event || !result || result.foul || result.cleared === false || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1000, Math.max(0, Math.round(800 * (event.field ? value / event.target : event.target / value))));
}
export function newMeet(key, seed = Date.now() >>> 0) {
  if (!Object.hasOwn(MEETS, key)) throw new Error("Unknown championship");
  return { version: 1, id: seed.toString(36) + "-" + Date.now().toString(36), key, seed, rounds: [] };
}
export function readMeet() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s || s.version !== 1 || typeof s.id !== "string" || !Object.hasOwn(MEETS, s.key) || !Number.isInteger(s.seed)
      || !Array.isArray(s.rounds) || s.rounds.length > 3 || s.rounds.some((r, i) => r?.event !== MEETS[s.key].events[i]
        || !Number.isInteger(r.points) || r.points < 0 || r.points > 1000)) return null;
    return s;
  } catch { return null; }
}
export function saveMeet(meet) {
  try { localStorage.setItem(KEY, JSON.stringify(meet)); return true; } catch { return false; }
}
export function meetURL(meet) {
  const event = MEETS[meet.key].events[Math.min(2, meet.rounds.length)];
  return "../" + event + "/?meet=" + encodeURIComponent(meet.id);
}
export function prepareMeet(race) {
  const s = readMeet(), requested = new URLSearchParams(globalThis.location?.search ?? "").get("meet");
  if (!s || s.id !== requested || s.rounds.length === 3 || MEETS[s.key].events[s.rounds.length] !== race.course.id) return;
  race.meetTicket = { id: s.id, round: s.rounds.length };
  race.setWeather((s.seed + s.rounds.length * 7919) >>> 0);
}
export function submitMeet(race) {
  const s = readMeet(), ticket = race.meetTicket;
  if (!race.terminal || !race.result || !ticket || !s || ticket.id !== s.id || ticket.round !== s.rounds.length
    || MEETS[s.key].events[s.rounds.length] !== race.course.id) return false;
  const event = race.course.id, points = eventPoints(event, race.result);
  const raw = EVENTS[event].field ? race.result.mark : race.result.time;
  s.rounds.push({ event, points, value: Number.isFinite(raw) ? raw : null,
    failed: !!race.result.foul || race.result.cleared === false });
  if (!saveMeet(s)) { race.meetSaveError = true; return false; }
  race.meetRecorded = true; return true;
}
export function standings(meet) {
  const rows = [{ name: "YOU", player: true, scores: meet.rounds.map(r => r.points) },
    ...["ATLAS", "NOVA", "PULSE"].map((name, rival) => ({ name, player: false,
      scores: meet.rounds.map((_, round) => 630 + rival * 65 + ((Math.imul(meet.seed + round * 97 + rival * 31, 1664525) >>> 0) % 101)) }))];
  rows.forEach(row => { row.total = row.scores.reduce((a, b) => a + b, 0); });
  rows.sort((a, b) => b.total - a.total);
  rows.forEach((row, i) => { row.rank = i && row.total === rows[i - 1].total ? rows[i - 1].rank : i + 1; });
  return rows;
}
