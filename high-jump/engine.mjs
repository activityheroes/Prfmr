import { RhythmRace, scoreZone, clamp } from "../sprint/engine.mjs?v=zones-2";
import { World, Body, Vec3, Sphere, Box } from "../javelin/cannon-es.mjs";
import { HIGH_JUMP_COURSE, TAKEOFF_ZONE, HIGH_JUMP, approachPoint, normalizeBar } from "./course.mjs?v=zones-2";
import { clearancePoints, getHighJumperPose } from "./jumper.mjs?v=zones-2";
export { HIGH_JUMP_COURSE, TAKEOFF_ZONE, HIGH_JUMP, approachPoint, normalizeBar };

export class HighJumpRace extends RhythmRace {
  constructor(loadout = {}, height = HIGH_JUMP.defaultBar) {
    super(loadout, HIGH_JUMP_COURSE);
    this.barHeight = normalizeBar(height); this.takeoffStart = null; this.launch = null; this.athlete = null;
    this.flightTime = 0; this.landTime = 0; this.peakHeight = 0;
    this.barHit = false; this.barFailed = false; this.barHitAt = null; this.barPassed = false; this.clearanceMargin = null;
  }
  get racing() { return super.racing || ["flight", "landing"].includes(this.phase); }
  get finishZone() { return TAKEOFF_ZONE; }
  get cue() { return this.phase === "line" ? this.zoneCue(TAKEOFF_ZONE, this.takeoffStart) : super.cue; }
  press() {
    if (this.launch) return false;
    if (this.phase !== "line") return super.press();
    if (this.holding) return false;
    this.holding = true; this.takeoffStart = { distance: this.distance, time: this.time, timing: this.timingWindow(TAKEOFF_ZONE) }; return true;
  }
  release() {
    if (this.phase === "line" && this.holding && this.takeoffStart) this.takeoff();
    else super.release();
  }
  cancelInput() { this.takeoffStart = null; super.cancelInput(); }
  takeoff() {
    const window = this.takeoffStart.timing;
    const timing = scoreZone({ ...TAKEOFF_ZONE, ...window }, this.takeoffStart.distance, this.distance);
    this.holding = false;
    if (timing.entry <= 0 || timing.hold < 0.25 || Math.abs(timing.releaseError) > window.edgeWindow) {
      this.finishAttempt("Missed takeoff"); return;
    }
    const startPose = getHighJumperPose(this), point = approachPoint(this.distance);
    const horizontal = 3.9 + Math.max(0, this.speed - 6) * 0.15, quality = timing.score / 100;
    const vy = (4.5 + Math.max(0, this.speed - 6) * 0.88) * (0.6 + quality * 0.4);
    this.launch = { x: point.x, y: startPose.hip.y, z: point.z, heading: point.heading,
      vx: Math.cos(point.heading) * horizontal, vy, vz: Math.sin(point.heading) * horizontal,
      timing, speed: this.speed, startPose };
    this.athlete = { x: this.launch.x, y: this.launch.y, z: this.launch.z }; this.peakHeight = this.athlete.y;
    this.world = new World({ gravity: new Vec3(0, -HIGH_JUMP.gravity, 0) });
    this.body = new Body({ mass: 70, shape: new Sphere(0.09), linearDamping: 0,
      position: new Vec3(this.athlete.x, this.athlete.y, this.athlete.z), velocity: new Vec3(this.launch.vx, vy, this.launch.vz) });
    const bar = new Body({ mass: 0, shape: new Box(new Vec3(HIGH_JUMP.barWidth / 2, 0.025, 0.035)),
      position: new Vec3(HIGH_JUMP.barX, this.barHeight, HIGH_JUMP.barZ), collisionResponse: false });
    this.body.addEventListener("collide", e => { if (e.body === bar) this.hitBar(); });
    this.world.addBody(this.body); this.world.addBody(bar); this.phase = "flight"; this.events.push("takeoff");
  }
  hitBar() {
    if (!this.barHit) { this.barHit = true; this.barHitAt = this.time; this.events.push("bar-hit"); }
    this.barFailed = true;
  }
  checkClearance(previous) {
    const points = clearancePoints(this);
    for (const [i, point] of points.entries()) {
      const before = previous[i], dz = Math.abs(point.z - HIGH_JUMP.barZ);
      const crossing = before && (before.z - HIGH_JUMP.barZ) * (point.z - HIGH_JUMP.barZ) <= 0 && before.z !== point.z;
      if (!crossing && dz > point.radius) continue;
      const t = crossing ? (HIGH_JUMP.barZ - before.z) / (point.z - before.z) : 1;
      const y = crossing ? before.y + (point.y - before.y) * t : point.y;
      const x = crossing ? before.x + (point.x - before.x) * t : point.x;
      if (Math.abs(x - HIGH_JUMP.barX) > HIGH_JUMP.barWidth / 2) { this.barFailed = true; continue; }
      const radius = crossing ? point.radius : Math.sqrt(Math.max(0, point.radius ** 2 - dz ** 2));
      const margin = y - radius - this.barHeight;
      this.clearanceMargin = Math.min(this.clearanceMargin ?? Infinity, margin);
      if (margin < 0) { this.barFailed = true; if (y + radius >= this.barHeight) this.hitBar(); }
    }
    if (!this.barPassed && points.every(p => p.z - p.radius > HIGH_JUMP.barZ)) {
      this.barPassed = true; this.events.push(this.barFailed ? "missed-bar" : "clear");
    }
  }
  step(dt) {
    if (this.phase === "flight") {
      const before = this.athlete, previous = clearancePoints(this); this.world.step(dt);
      const { x, y, z } = this.body.position;
      const landed = y <= HIGH_JUMP.landingY && this.body.velocity.y < 0;
      const fraction = landed ? clamp((before.y - HIGH_JUMP.landingY) / (before.y - y), 0, 1) : 1;
      this.time += dt * fraction; this.flightTime += dt * fraction;
      this.athlete = { x: before.x + (x - before.x) * fraction, y: landed ? HIGH_JUMP.landingY : y, z: before.z + (z - before.z) * fraction };
      this.peakHeight = Math.max(this.peakHeight, this.athlete.y); this.checkClearance(previous);
      if (landed) { this.phase = "landing"; this.events.push("land"); }
      return;
    }
    if (this.phase === "landing") {
      this.landTime += dt; this.time += dt;
      if (this.landTime >= 0.7) {
        const inMat = Math.abs(this.athlete.x - HIGH_JUMP.matX) < HIGH_JUMP.matWidth / 2 - 0.3 && Math.abs(this.athlete.z - HIGH_JUMP.matZ) < HIGH_JUMP.matDepth / 2 - 0.3;
        this.finishAttempt(!inMat ? "Outside the mat" : !this.barPassed || this.barFailed ? this.barHit ? "Bar knocked off" : "Below the bar" : null);
      }
      return;
    }
    const wasLine = this.phase === "line"; super.step(dt);
    if (!wasLine && this.phase === "line") this.cancelInput();
    if (this.terminal) { this.events = this.events.filter(e => e !== "finish"); this.finishAttempt("Missed takeoff"); }
  }
  finishAttempt(reason) {
    this.phase = "finished"; this.holding = false; this.finishTime = this.time - this.startAt;
    this.result = { cleared: reason === null, reason, mark: reason === null ? this.barHeight : null,
      barHeight: this.barHeight, peakHeight: this.peakHeight, takeoffGrade: this.launch?.timing.grade ?? "Miss",
      takeoffScore: this.launch?.timing.score ?? 0, approachSpeed: this.launch?.speed ?? this.speed,
      clearanceMargin: this.clearanceMargin, barHit: this.barHit, time: this.finishTime,
      rhythmScore: this.rhythmScore, counts: { ...this.counts }, bestCombo: this.bestCombo,
      zones: this.zones.map(z => ({ ...z.result })) };
    this.events.push("finish");
  }
}
