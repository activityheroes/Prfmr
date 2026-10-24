import { RhythmRace, scoreZone, clamp, longZones } from "../sprint/engine.mjs?v=sports-1";
import { World, Body, Vec3, Sphere } from "./cannon-es.mjs";
import { getReleaseOrigin } from "./thrower.mjs?v=sports-1";

export const JAVELIN_COURSE = {
  id: "javelin", distance: 45, finishAt: 39.5, fatigueAt: 41, finishMove: false,
  baseSpeed: 6.5, acceleration: 6, maxSpeeds: [9, 9.5, 10],
  zones: longZones([[6, 14], [24, 33]], 6.5)
};
export const THROW_ZONE = { start: 40, end: 43.5, edgeWindow: 1.2, perfectEdge: 0.15 };
export const GRAVITY = 9.81;

export class JavelinRace extends RhythmRace {
  constructor(loadout = {}) {
    super(loadout, JAVELIN_COURSE);
    this.throwStart = null; this.launch = null; this.projectile = null; this.flightTime = 0;
  }
  get racing() { return super.racing || this.phase === "flight"; }
  get finishZone() { return THROW_ZONE; }
  get cue() {
    if (this.phase !== "line") return super.cue;
    return this.zoneCue(THROW_ZONE, this.throwStart);
  }
  press() {
    if (this.phase === "flight") return false;
    if (this.phase !== "line") return super.press();
    if (this.holding) return false;
    this.holding = true; this.throwStart = { distance: this.distance, time: this.time, timing: this.timingWindow(THROW_ZONE) }; return true;
  }
  release() {
    if (this.phase === "line" && this.throwStart && this.holding) this.throwJavelin();
    else super.release();
  }
  cancelInput() { this.throwStart = null; super.cancelInput(); }
  throwJavelin() {
    const timing = scoreZone({ ...THROW_ZONE, ...this.throwStart.timing }, this.throwStart.distance, this.distance);
    const angle = clamp(38 + (this.distance - THROW_ZONE.end) * 12, 22, 52);
    const speed = (12 + this.speed * 1.6) * (0.55 + timing.score / 100 * 0.45);
    const radians = angle * Math.PI / 180, vx = speed * Math.cos(radians), vy = speed * Math.sin(radians);
    const { x, height } = getReleaseOrigin(this);
    this.launch = { x, height, vx, vy, angle, speed, runupSpeed: this.speed, timing };
    this.world = new World({ gravity: new Vec3(0, -GRAVITY, 0) });
    this.body = new Body({ mass: 0.8, shape: new Sphere(0.005), linearDamping: 0,
      position: new Vec3(this.launch.x, height, 0), velocity: new Vec3(vx, vy, 0) });
    this.world.addBody(this.body);
    this.projectile = { x: this.launch.x, y: height, angle: radians }; this.holding = false; this.phase = "flight";
    this.events.push("throw");
  }
  step(dt) {
    if (this.phase === "flight") {
      const previous = this.projectile;
      this.body.applyForce(new Vec3(this.conditions.wind * 0.18 * this.body.mass, 0, 0));
      this.world.step(dt);
      const { x, y } = this.body.position;
      const fraction = y <= 0 ? previous.y / (previous.y - y) : 1;
      this.flightTime += dt * fraction; this.time += dt * fraction;
      this.projectile = { x: previous.x + (x - previous.x) * fraction, y: Math.max(0, y),
        angle: Math.atan2(this.body.velocity.y, this.body.velocity.x) };
      if (y <= 0) this.finishAttempt(false);
      return;
    }
    const wasLine = this.phase === "line";
    super.step(dt);
    if (!wasLine && this.phase === "line") this.cancelInput();
    if (this.terminal) {
      this.events = this.events.filter(event => event !== "finish");
      this.finishAttempt(true);
    }
  }
  finishAttempt(foul) {
    this.phase = "finished"; this.holding = false; this.finishTime = this.time - this.startAt;
    this.result = { foul, mark: foul ? null : Math.max(0, this.projectile.x - this.course.distance),
      releaseGrade: foul ? "Foul" : this.launch.timing.grade,
      releaseScore: foul ? 0 : this.launch.timing.score, angle: this.launch?.angle ?? null,
      launchSpeed: this.launch?.speed ?? null, runupSpeed: this.launch?.runupSpeed ?? this.speed,
      time: this.finishTime, flightTime: this.flightTime, rhythmScore: this.rhythmScore,
      counts: { ...this.counts }, bestCombo: this.bestCombo, peakSpeed: this.peakSpeed,
      zones: this.zones.map(zone => ({ ...zone.result })) };
    this.events.push("finish");
  }
}
