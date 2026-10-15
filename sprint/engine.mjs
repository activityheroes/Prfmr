export const DIP = { peak: 0.09, duration: 0.32, reach: 0.34, perfectWindow: 0.022 };
export const ZONES = [15, 30, 45, 60, 75, 90].map((start, index) => ({
  id: index + 1, start, end: start + (index === 5 ? 3 : 5),
  edgeWindow: index === 5 ? 0.9 : 1.6, perfectEdge: index === 5 ? 0.13 : 0.25
}));
export const SPRINT_COURSE = {
  id: "sprint", distance: 100, finishAt: 98.5, fatigueAt: 90, finishMove: true,
  baseSpeed: 8, acceleration: 7.8, maxSpeeds: [11.2, 11.8, 12.4], zones: ZONES
};
export const REWARDS = {
  Perfect: { boost: 0.15, momentum: 0.8 }, Great: { boost: 0.1, momentum: 0.5 },
  Good: { boost: 0.06, momentum: 0.25 }, Early: { boost: 0.02, momentum: 0 },
  Late: { boost: 0, momentum: -0.4 }, Miss: { boost: 0, momentum: -0.4 }
};
export const GEAR = {
  band: { label: "Timing band", options: ["Club band", "Focus band", "Reflex band"] },
  blocks: { label: "Starting blocks", options: ["Club blocks", "Launch blocks", "Carbon blocks"] },
  spikes: { label: "Race spikes", options: ["Club spikes", "Velocity spikes", "Elite spikes"] },
  kit: { label: "Race kit", options: ["Club kit", "Aero kit", "Endurance kit"] }
};
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
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
  // Intersection-over-union rewards covering the zone, not simply holding for a preset duration.
  const overlap = Math.max(0, Math.min(releaseDistance, zone.end) - Math.max(pressDistance, zone.start));
  const union = Math.max(releaseDistance, zone.end) - Math.min(pressDistance, zone.start);
  const entry = accuracy(entryError), hold = overlap / union, release = accuracy(releaseError);
  const score = (entry * 0.3 + hold * 0.3 + release * 0.4) * 100;
  let grade;
  if (hold < 0.25 || entry <= 1e-9) grade = "Miss";
  else if (releaseError > edgeWindow * 0.5) grade = "Late";
  else if (score >= 92) grade = "Perfect";
  else if (score >= 80) grade = "Great";
  else if (score >= 65) grade = "Good";
  else grade = releaseError < -perfectEdge ? "Early" : releaseError > perfectEdge ? "Late" : "Miss";
  return { grade, score, entry, hold, release, entryError, releaseError };
}

export class RhythmRace {
  constructor(loadout = {}, course = SPRINT_COURSE) {
    this.course = course;
    this.stats = getStats(loadout, course);
    this.zones = course.zones.map(zone => ({ ...zone, status: "pending", attempt: null, result: null }));
    this.phase = "ready"; this.time = 0; this.distance = 0; this.speed = 0;
    this.startAt = null; this.releaseAt = null; this.holding = false; this.activeHold = null;
    this.momentum = 0; this.temporaryBoost = 0; this.fatigue = 0;
    this.lastAttempt = null; this.offZoneAt = -100;
    this.counts = { Perfect: 0, Great: 0, Good: 0, Early: 0, Late: 0, Miss: 0 };
    this.combo = 0; this.bestCombo = 0; this.peakSpeed = 0;
    this.dipAt = null; this.earlyDip = false; this.finishTime = null; this.result = null; this.events = [];
  }
  get racing() { return this.phase === "sprint" || this.phase === "line"; }
  get terminal() { return this.phase === "finished"; }
  get attempts() { return Object.values(this.counts).reduce((sum, count) => sum + count, 0); }
  get rhythmScore() { return this.attempts ? this.zones.reduce((sum, z) => sum + (z.result?.score ?? 0), 0) / this.attempts : 0; }
  get elapsed() { return this.finishTime ?? (this.startAt === null ? 0 : this.time - this.startAt); }
  get dipAmount() { return this.leanAt(this.time); }
  get nextZone() { return this.activeHold ?? this.zones.find(z => z.status === "pending") ?? null; }
  get cue() {
    if (this.phase !== "sprint") return this.phase;
    if (this.activeHold) return this.distance >= this.activeHold.end - this.activeHold.perfectEdge * this.stats.timingTolerance ? "release" : "hold";
    if (this.holding) return "lift";
    const zone = this.nextZone;
    if (zone && this.distance >= zone.start - zone.perfectEdge * this.stats.timingTolerance && this.distance <= zone.end) return "press";
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
      this.events.push("start"); return true;
    }
    if (this.phase === "line") return this.dip();
    this.holding = true;
    const zone = this.nextZone;
    if (zone && this.distance >= zone.start - zone.edgeWindow * this.stats.timingTolerance && this.distance <= zone.end) {
      zone.status = "holding"; zone.attempt = { distance: this.distance, time: this.time };
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
    const metrics = zone.attempt ? scoreZone(zone, zone.attempt.distance, this.distance, this.stats.timingTolerance)
      : { grade: "Miss", score: 0, entry: 0, hold: 0, release: 0, entryError: null, releaseError: null };
    if (forcedGrade) metrics.grade = forcedGrade;
    if (canceled) metrics.score = metrics.entry = metrics.hold = metrics.release = 0;
    const { grade } = metrics, reward = REWARDS[grade];
    zone.status = "done";
    zone.result = { ...metrics, zoneId: zone.id, time: this.time, canceled,
      duration: zone.attempt ? this.time - zone.attempt.time : 0, boost: reward.boost };
    this.lastAttempt = zone.result; this.counts[grade]++;
    this.combo = ["Perfect", "Great", "Good"].includes(grade) ? this.combo + 1 : 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.momentum = clamp(this.momentum + reward.momentum * (this.course.momentumScale ?? 1), 0, this.stats.maxSpeed - this.stats.baseSpeed);
    if (reward.boost) {
      const boostedSpeed = Math.min(this.stats.maxSpeed, this.speed * (1 + reward.boost));
      this.temporaryBoost = Math.max(this.temporaryBoost, boostedSpeed - this.stats.baseSpeed - this.momentum, 0);
      this.speed = boostedSpeed;
    } else if (grade === "Late") {
      this.temporaryBoost *= 0.4; this.speed = Math.max(this.stats.baseSpeed, this.speed * 0.97);
    }
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
  }
  step(dt) {
    const beforeTime = this.time; this.time += dt;
    if (!this.racing) return;
    const decayScale = this.course.momentumScale ?? 1;
    this.momentum = Math.max(0, this.momentum - 0.1 * decayScale * dt / this.stats.endurance);
    this.temporaryBoost = Math.max(0, this.temporaryBoost - 0.65 * decayScale * dt / this.stats.endurance);
    if (this.distance >= this.course.fatigueAt) this.fatigue += 0.045 * dt / this.stats.endurance;
    const cap = Math.max(this.stats.baseSpeed, this.stats.maxSpeed * (1 - Math.min(0.15, this.fatigue)));
    const target = Math.min(cap, this.stats.baseSpeed + this.momentum + this.temporaryBoost);
    if (this.dipAt !== null && !this.earlyDip && this.time - this.dipAt > DIP.peak + 0.035) {
      this.earlyDip = true; this.speed *= 0.9; this.events.push("early-dip");
    }
    const previousSpeed = this.speed, acceleration = this.stats.acceleration;
    this.speed = this.speed < target
      ? Math.min(target, this.speed + acceleration * (0.3 + 0.7 * (1 - this.speed / target)) * dt)
      : Math.max(target, this.speed - acceleration * 0.55 * dt);
    this.peakSpeed = Math.max(this.peakSpeed, this.speed);
    const previousDistance = this.distance;
    this.distance += (previousSpeed + this.speed) * 0.5 * dt;
    for (const zone of this.zones) {
      if (zone.status !== "done" && this.distance > zone.end + zone.edgeWindow * this.stats.timingTolerance) {
        this.resolveZone(zone, zone.attempt ? "Late" : "Miss");
      }
    }
    if (this.phase === "sprint" && this.distance >= this.course.finishAt) { this.phase = "line"; this.events.push("line"); }
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
        zones: this.zones.map(z => ({ ...z.result })), dip: dipGrade, torsoLead: this.dipAmount * DIP.reach };
      this.events.push("finish");
    }
  }
}

export class SprintRace extends RhythmRace {}
