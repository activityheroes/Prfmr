import { WEATHER } from "./weather.mjs?v=rivals-1";
const VERSION = 1;
const ACTIONS = ["press", "release", "cancelInput", "dip"];
export const courseSignature = course => JSON.stringify([VERSION, course.id, course.distance,
  course.zones.map(z => [z.start, z.end]), course.baseSpeed, course.maxSpeeds]);

export function validReplay(record, course) {
  if (!record || record.signature !== courseSignature(course) || !Number.isFinite(record.time) || record.time <= 0 || record.time > 600
    || !Number.isFinite(record.readyTime) || record.readyTime < 0 || record.readyTime > 86400
    || !Array.isArray(record.inputs) || !record.inputs.length || record.inputs.length > 512
    || !Array.isArray(record.inputs[0]) || record.inputs[0][0] !== 0 || record.inputs[0][1] !== "press"
    || !record.weather || !Number.isFinite(record.weather.seed)
    || !Object.hasOwn(WEATHER, record.weather.base) || record.weather.front !== null && !Object.hasOwn(WEATHER, record.weather.front)
    || ["frontAt", "duration", "warning", "transition"].some(key => !Number.isFinite(record.weather[key]) || record.weather[key] < 0)
    || !record.loadout || Object.values(record.loadout).some(n => !Number.isInteger(n) || n < 0 || n > 2)) return false;
  let previous = 0;
  return record.inputs.every(input => {
    if (!Array.isArray(input) || input.length !== 2) return false;
    const [time, action] = input;
    if (!Number.isFinite(time) || time < previous || time > record.time + 0.05 || !ACTIONS.includes(action)) return false;
    previous = time; return true;
  });
}

// Record inputs, not frames: a complete race stays small and poses use the real sport engine.
export function attachReplay(race, factory, loadout, record = null) {
  const recording = { signature: courseSignature(race.course), loadout: { ...loadout }, inputs: [], readyTime: 0, overflow: false };
  let nested = false;
  for (const action of ACTIONS) {
    const original = race[action];
    if (!original) continue;
    race[action] = function(...args) {
      const capture = !nested && !this.terminal && (this.startAt !== null || action === "press");
      const time = this.startAt === null ? 0 : this.time - this.startAt, ready = this.phase === "ready";
      if (capture && ready) recording.readyTime = this.time;
      const wasNested = nested; nested = true;
      let result;
      try { result = original.apply(this, args); } finally { nested = wasNested; }
      if (capture && result !== false) {
        if (recording.inputs.length < 512) recording.inputs.push([time, action]);
        else recording.overflow = true;
      }
      return result;
    };
  }
  race.recording = recording;
  if (validReplay(record, race.course)) {
    const ghost = factory(record.loadout);
    ghost.weather = Object.freeze({ ...record.weather }); ghost.time = record.readyTime;
    race.rival = { ghost, record, index: 0 };
  }
  return race;
}

export function advanceReplay(race) {
  if (!race.rival || race.startAt === null) return;
  const rival = race.rival, ghost = rival.ghost, target = race.time - race.startAt;
  while (rival.index < rival.record.inputs.length && rival.record.inputs[rival.index][0] <= target + 1e-8) {
    const [at, action] = rival.record.inputs[rival.index++];
    const elapsed = ghost.startAt === null ? 0 : ghost.time - ghost.startAt;
    ghost.advance(Math.max(0, at - elapsed)); ghost[action]();
  }
  ghost.advance(Math.max(0, target - (ghost.time - ghost.startAt))); ghost.events.length = 0;
}

export function finishReplay(race) {
  if (!race.terminal || !race.result || race.result.foul || !race.recording || race.recording.overflow) return null;
  const { overflow, ...record } = race.recording;
  return { ...record, inputs: record.inputs.map(input => [...input]), weather: { ...race.weather }, time: race.result.time };
}
