import { createWeather, weatherAt, randomWeatherSeed, weatherSummary } from "./weather.mjs?v=sports-1";

export const DIP = { peak: 0.09, duration: 0.32, reach: 0.34, perfectWindow: 0.022 };
export function longZones(ranges, speed) {
  return ranges.map(([start, end], i) => ({ id: i + 1, start, end, longHold: true,
    difficulty: i / Math.max(1, ranges.length - 1), edgeWindow: speed * 0.4, perfectEdge: speed * 0.1 }));
}
export const ZONES = longZones([[15, 31], [60, 78]], 8);
export const SPRINT_COURSE = {
  id: "sprint", distance: 100, finishAt: 98.5, fatigueAt: 90, finishMove: true,
  baseSpeed: 8, acceleration: 7.8, maxSpeeds: [11.2, 11.8, 12.4], zones: ZONES
};
export const REWARDS = {
  Perfect: { boost: 0.15, momentum: 0.8 }, Great: { boost: 0.1, momentum: 0.5 },
  Good: { boost: 0.06, momentum: 0.25 }, Early: { boost: 0.02, momentum: 0 },
  Late: { boost: 0, momentum: -0.4 }, Miss: { boost: 0, momentum: -0.4 }
};
export const MODES = { flowStreak: 1, perfectStreak: 2, flameDuration: 6, flowGain: 0.05, flameGain: 0.2, burstDuration: 1.25 };
export const GEAR = {
  band: { label: "Timing band", options: ["Club band", "Focus band", "Reflex band"] },
  blocks: { label: "Starting blocks", options: ["Club blocks", "Launch blocks", "Carbon blocks"] },
  spikes: { label: "Race spikes", options: ["Club spikes", "Velocity spikes", "Elite spikes"] },
  kit: { label: "Race kit", options: ["Club kit", "Aero kit", "Endurance kit"] }
};
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const TIMING = { prepare: 0.65, cueLead: 0.12 };
export function getTimingWindow(zone, speed, tolerance = 1) {
  const difficulty = zone.difficulty ?? (zone.id == null ? 0.65 : clamp((zone.id - 1) / 5, 0, 1));
  if (zone.longHold) return {
    edgeWindow: Math.max(zone.edgeWindow, speed * (0.48 - difficulty * 0.06)) * tolerance,
    perfectEdge: Math.max(zone.perfectEdge, speed * (0.14 - difficulty * 0.03)) * tolerance
  };
  return {
    edgeWindow: Math.max(zone.edgeWindow, speed * (0.24 - difficulty * 0.06)) * tolerance,
    perfectEdge: Math.max(zone.perfectEdge, speed * (0.07 - difficulty * 0.025)) * tolerance
  };
}
export function getStats(loadout = {}, course = SPRINT_COURSE) {
  const tier = key => clamp(Math.floor(Number(loadout[key]) || 0), 0, 2);
  return {
    timingTolerance: [1, 1.15, 1.3][tier("band")], baseSpeed: course.baseSpeed,
    acceleration: course.acceleration * [1, 1.1, 1.2][tier("blocks")],
    maxSpeed: course.maxSpeeds[tier("spikes")], endurance: [1, 1.35, 1.8][tier("kit")]
  };
}
export function scoreZone(zone, pressDistance, releaseDistance, tolerance = 1) {
  const edgeWindow = zone.edgeWindow * tolerance, perfectEdge = zone.perfectEdge * tolerance;
  const accuracy = error => 1 - clamp((Math.abs(error) - perfectEdge) / (edgeWindow - perfectEdge), 0, 1);
  const entryError = pressDistance - zone.start, releaseError = releaseDistance - zone.end;
  // Edge accuracy already penalizes early/late input; hold measures zone coverage only.
  const overlap = Math.max(0, Math.min(releaseDistance, zone.end) - Math.max(pressDistance, zone.start));
  const entry = accuracy(entryError), hold = overlap / (zone.end - zone.start), release = accuracy(releaseError);
  const score = (entry * 0.3 + hold * 0.3 + release * 0.4) * 100;
  let grade;
  if (hold < 0.25 || entry <= 1e-9) grade = "Miss";
  else if (releaseError > edgeWindow * 0.85) grade = "Late";
  else if (score >= 92 && entry >= 0.9 && release >= 0.9) grade = "Perfect";
  else if (score >= 80) grade = "Great";
  else if (score >= 65) grade = "Good";
  else grade = releaseError < -perfectEdge ? "Early" : releaseError > perfectEdge ? "Late" : "Miss";
  return { grade, score, entry, hold, release, entryError, releaseError };
}

// Use the actual scoring curve, including entry quality, for both track and HUD bands.
export function releaseBands(zone, pressDistance = zone.start, hardEnd = Infinity) {
  const bad = { start: zone.end - zone.edgeWindow, end: zone.end + zone.edgeWindow };
  const range = grades => {
    const accepts = distance => distance < hardEnd && grades.includes(scoreZone(zone, pressDistance, distance).grade);
    if (!accepts(zone.end)) return null;
    let lo = bad.start, hi = zone.end;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (accepts(mid)) hi = mid; else lo = mid; }
    const start = hi; lo = zone.end; hi = bad.end;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (accepts(mid)) lo = mid; else hi = mid; }
    return { start, end: lo };
  };
  return { bad, good: range(["Perfect", "Great", "Good"]), perfect: range(["Perfect"]) };
}

export class RhythmRace {
  constructor(loadout = {}, course = SPRINT_COURSE) {
    this.course = course;
    this.weather = createWeather(course);
    this.stats = getStats(loadout, course);
    this.zones = course.zones.map(zone => ({ ...zone, status: "pending", attempt: null, result: null }));
    this.phase = "ready"; this.time = 0; this.distance = 0; this.speed = 0;
    this.startAt = null; this.releaseAt = null; this.holding = false; this.activeHold = null;
    this.momentum = 0; this.temporaryBoost = 0; this.fatigue = 0;
    this.lastAttempt = null; this.offZoneAt = -100;
    this.counts = { Perfect: 0, Great: 0, Good: 0, Early: 0, Late: 0, Miss: 0 };
    this.combo = 0; this.bestCombo = 0; this.peakSpeed = 0;
    this.perfectStreak = 0; this.flameReady = false; this.flameRemaining = 0; this.flameCount = 0; this.burstRemaining = 0;
    this.dipAt = null; this.earlyDip = false; this.finishTime = null; this.result = null; this.events = [];
  }
  get racing() { return this.phase === "sprint" || this.phase === "line"; }
  setWeather(seed = randomWeatherSeed(), kind = "random") {
    if (this.phase === "ready") this.weather = createWeather(this.course, seed, kind);
    return this;
  }
  get conditions() { return weatherAt(this.weather, this.startAt === null ? 0 : this.time - this.startAt); }
  get terminal() { return this.phase === "finished"; }
  get mode() { return this.flameRemaining > 0 ? "flame" : this.combo >= MODES.flowStreak ? "flow" : "normal"; }
  get canActivateFlame() {
    return this.flameReady && this.flameRemaining === 0 && ["sprint", "line"].includes(this.phase)
      && !this.terminal && !this.launch && !this.plant;
  }
  activateFlame() {
    if (!this.canActivateFlame) return false;
    this.flameReady = false; this.flameRemaining = MODES.flameDuration; this.flameCount++;
    this.speed = Math.min(this.speedLimit, this.speed + this.stats.baseSpeed * MODES.flameGain);
    this.peakSpeed = Math.max(this.peakSpeed, this.speed);
    this.events.push("ignite"); return true;
  }
  get modeGain() { return this.mode === "flame" ? MODES.flameGain : this.mode === "flow" ? MODES.flowGain : 0; }
  get speedLimit() {
    // Technical events retain their tested launch envelope; modes build speed up to it faster.
    const technical = !!this.finishZone || this.course.id === "hurdles";
    return this.stats.maxSpeed * (1 + (technical ? 0 : this.modeGain));
  }
  get attempts() { return Object.values(this.counts).reduce((sum, count) => sum + count, 0); }
  get rhythmScore() { return this.attempts ? this.zones.reduce((sum, z) => sum + (z.result?.score ?? 0), 0) / this.attempts : 0; }
  get elapsed() { return this.finishTime ?? (this.startAt === null ? 0 : this.time - this.startAt); }
  get dipAmount() { return this.leanAt(this.time); }
  get nextZone() { return this.activeHold ?? this.zones.find(z => z.status === "pending") ?? null; }
  get cue() {
    if (this.phase !== "sprint") return this.phase;
    return this.zoneCue(this.nextZone, this.activeHold?.attempt);
  }
  timingWindow(zone, attempt = zone?.attempt) {
    return attempt?.timing ?? getTimingWindow(zone, Math.max(this.stats.baseSpeed, this.speed), this.stats.timingTolerance);
  }
  zoneCue(zone, attempt = null) {
    if (!zone) return this.holding ? "lift" : "run";
    const speed = Math.max(this.stats.baseSpeed, this.speed), window = this.timingWindow(zone, attempt);
    const lead = Math.min(speed * TIMING.cueLead, window.edgeWindow * 0.75);
    const releaseLead = Math.min(speed * (zone.releaseLead ?? TIMING.cueLead), window.edgeWindow * 0.95);
    if (attempt && this.holding) return this.distance >= zone.end - releaseLead ? "release" : "hold";
    if (this.holding) return "lift";
    if (this.distance >= zone.start - lead && this.distance <= Math.min(zone.end, zone.start + window.edgeWindow)) return "press";
    if (this.distance < zone.start && zone.start - this.distance <= speed * TIMING.prepare) return "prepare";
    return "run";
  }
  leanAt(time) {
    if (!this.course.finishMove || this.dipAt === null) return 0;
    const age = time - this.dipAt;
    if (age < 0 || age >= DIP.duration) return 0;
    return age <= DIP.peak ? Math.sin(age / DIP.peak * Math.PI / 2)
      : Math.cos((age - DIP.peak) / (DIP.duration - DIP.peak) * Math.PI / 2);
  }
  press() {
    if (this.terminal || this.holding) return false;
    if (this.phase === "ready") {
      this.phase = "sprint"; this.startAt = this.releaseAt = this.time; this.holding = true;
      this.speed = this.course.rollingSpeed ?? 0;
      this.events.push("start"); return true;
    }
    if (this.phase === "line") return this.dip();
    this.holding = true;
    const zone = this.nextZone;
    const timing = zone && this.timingWindow(zone);
    if (zone && this.distance >= zone.start - timing.edgeWindow && this.distance <= Math.min(zone.end, zone.start + timing.edgeWindow)) {
      zone.status = "holding"; zone.attempt = { distance: this.distance, time: this.time, timing };
      this.activeHold = zone; this.events.push("hold");
    } else { this.offZoneAt = this.time; this.events.push("off-zone"); }
    return true;
  }
  release() {
    if (this.activeHold) this.resolveZone(this.activeHold);
    this.holding = false;
  }
  cancelInput() {
    if (this.activeHold) this.resolveZone(this.activeHold, "Miss", true);
    this.holding = false;
  }
  resolveZone(zone, forcedGrade = null, canceled = false) {
    if (zone.status === "done") return;
    const metrics = zone.attempt ? scoreZone({ ...zone, ...this.timingWindow(zone) }, zone.attempt.distance, this.distance)
      : { grade: "Miss", score: 0, entry: 0, hold: 0, release: 0, entryError: null, releaseError: null };
    if (forcedGrade) metrics.grade = forcedGrade;
    if (canceled) metrics.score = metrics.entry = metrics.hold = metrics.release = 0;
    const { grade } = metrics, reward = REWARDS[grade], beforeSpeed = this.speed;
    zone.status = "done";
    zone.result = { ...metrics, zoneId: zone.id, time: this.time, canceled,
      duration: zone.attempt ? this.time - zone.attempt.time : 0, boost: reward.boost };
    this.lastAttempt = zone.result; this.counts[grade]++;
    this.combo = ["Perfect", "Great", "Good"].includes(grade) ? this.combo + 1 : 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.perfectStreak = grade === "Perfect" ? this.perfectStreak + 1 : 0;
    if (!this.combo) this.flameRemaining = 0;
    const charged = this.perfectStreak > 0 && this.perfectStreak % MODES.perfectStreak === 0;
    if (charged) this.flameReady = true;
    const rewardScale = zone.longHold && reward.momentum > 0 ? 3 : 1;
    this.momentum = clamp(this.momentum + reward.momentum * rewardScale * (this.course.momentumScale ?? 1), 0, this.stats.maxSpeed - this.stats.baseSpeed);
    if (reward.boost) {
      const boostedSpeed = Math.min(this.speedLimit, this.speed * (1 + reward.boost));
      this.temporaryBoost = Math.max(this.temporaryBoost, boostedSpeed - this.stats.baseSpeed * (1 + this.modeGain) - this.momentum, 0);
      this.burstRemaining = MODES.burstDuration;
      this.speed = boostedSpeed;
    } else if (grade === "Late") {
      this.temporaryBoost *= 0.4; this.speed = Math.max(this.stats.baseSpeed * this.conditions.pace, this.speed * 0.97);
    }
    Object.assign(zone.result, { speedBefore: beforeSpeed, speedAfter: this.speed,
      speedGain: Math.max(0, this.speed - beforeSpeed), mode: this.mode, charged, ignited: false });
    this.peakSpeed = Math.max(this.peakSpeed, this.speed);
    if (this.activeHold === zone) this.activeHold = null;
    this.events.push({ type: "zone", result: zone.result });
  }
  dip() {
    if (!this.course.finishMove || this.phase !== "line" || this.dipAt !== null) return false;
    this.dipAt = this.time; this.events.push("dip"); return true;
  }
  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.terminal) return;
    if (this.phase === "ready") { this.time += seconds; return; }
    let remaining = seconds;
    while (remaining > 1e-10 && !this.terminal) {
      const dt = Math.min(remaining, 1 / 240); this.step(dt); remaining -= dt;
    }
    if (this.terminal && this.result) this.result.weather = { seed: this.weather.seed, summary: weatherSummary(this.weather),
      finish: this.conditions.key, wind: this.conditions.wind };
  }
  step(dt) {
    const beforeTime = this.time; this.time += dt;
    if (!this.racing) return;
    this.flameRemaining = Math.max(0, this.flameRemaining - dt);
    this.burstRemaining = Math.max(0, this.burstRemaining - dt);
    const decayScale = this.course.momentumScale ?? 1;
    this.momentum = Math.max(0, this.momentum - 0.1 * decayScale * dt / this.stats.endurance);
    if (!this.burstRemaining) this.temporaryBoost = Math.max(0, this.temporaryBoost - 0.32 * decayScale * dt / this.stats.endurance);
    if (this.distance >= this.course.fatigueAt) this.fatigue += 0.045 * dt / this.stats.endurance;
    const cap = Math.max(this.stats.baseSpeed, this.speedLimit * (1 - Math.min(0.15, this.fatigue)));
    const conditions = this.conditions;
    const target = Math.min(cap, (this.stats.baseSpeed * (1 + this.modeGain) + this.momentum + this.temporaryBoost) * conditions.pace);
    if (this.dipAt !== null && !this.earlyDip && this.time - this.dipAt > DIP.peak + 0.035) {
      this.earlyDip = true; this.speed *= 0.9; this.events.push("early-dip");
    }
    const previousSpeed = this.speed, acceleration = this.stats.acceleration * conditions.grip;
    this.speed = this.speed < target
      ? Math.min(target, this.speed + acceleration * (0.3 + 0.7 * (1 - this.speed / target)) * dt)
      : Math.max(target, this.speed - acceleration * 0.55 * dt);
    this.peakSpeed = Math.max(this.peakSpeed, this.speed);
    const previousDistance = this.distance;
    this.distance += (previousSpeed + this.speed) * 0.5 * dt;
    for (const zone of this.zones) {
      if (zone.status !== "done" && this.distance > zone.end + this.timingWindow(zone).edgeWindow) {
        this.resolveZone(zone, zone.attempt ? "Late" : "Miss");
      }
    }
    const preparingAction = this.finishZone && !this.nextZone && this.distance >= this.finishZone.start - Math.max(this.speed, this.stats.baseSpeed) * TIMING.prepare;
    if (this.phase === "sprint" && (this.distance >= this.course.finishAt || preparingAction)) { this.phase = "line"; this.events.push("line"); }
    const beforeFront = previousDistance + this.leanAt(beforeTime) * DIP.reach;
    const afterFront = this.distance + this.dipAmount * DIP.reach;
    if (afterFront >= this.course.distance) {
      const fraction = clamp((this.course.distance - beforeFront) / (afterFront - beforeFront), 0, 1);
      this.time = beforeTime + dt * fraction;
      this.distance = previousDistance + (this.distance - previousDistance) * fraction;
      this.finishTime = this.time - this.startAt;
      const age = this.dipAt === null ? null : this.time - this.dipAt;
      const dipGrade = !this.course.finishMove ? null : age === null ? "No dip" : Math.abs(age - DIP.peak) <= DIP.perfectWindow ? "Perfect"
        : this.earlyDip ? "Early" : age < DIP.peak ? "Late" : "Good";
      this.phase = "finished"; this.holding = false;
      this.result = { title: "Finish", time: this.finishTime, rhythmScore: this.rhythmScore,
        counts: { ...this.counts }, attempts: this.attempts, bestCombo: this.bestCombo, peakSpeed: this.peakSpeed,
        zones: this.zones.map(z => ({ ...z.result })), dip: dipGrade, torsoLead: this.dipAmount * DIP.reach,
        flameCount: this.flameCount };
      this.events.push("finish");
    }
  }
}

export class SprintRace extends RhythmRace {}
