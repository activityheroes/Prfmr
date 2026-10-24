import { RhythmRace, scoreZone, clamp, longZones } from "../sprint/engine.mjs?v=starts-1";
import { World, Body, Vec3, Sphere } from "../javelin/cannon-es.mjs";
import { landingHeels } from "./jumper.mjs?v=starts-1";

export const LONG_JUMP_COURSE = {
  id: "long-jump", distance: 45, finishAt: 39.5, fatigueAt: 42, finishMove: false,
  baseSpeed: 6.5, acceleration: 6, maxSpeeds: [9, 9.5, 10],
  zones: longZones([[6, 14], [24, 33]], 6.5)
};
// The physical board cannot grant late grace, so give the release cue extra lead time.
export const TAKEOFF_ZONE = { start: 40, end: 44.75, edgeWindow: 1.2, perfectEdge: 0.15, releaseLead: 0.2 };
export const JUMP = { gravity: 9.81, board: 45, pitStart: 47, pitEnd: 58, hipHeight: 1.25, landingHeight: 0.6 };

export class LongJumpRace extends RhythmRace {
  constructor(loadout = {}) {
    super(loadout, LONG_JUMP_COURSE);
    this.takeoffStart = null; this.launch = null; this.athlete = null;
    this.flightTime = 0; this.landTime = 0; this.peakHeight = 0; this.landing = null;
  }
  get racing() { return super.racing || this.phase === "flight" || this.phase === "landing"; }
  get finishZone() { return TAKEOFF_ZONE; }
  get cue() {
    if (this.phase !== "line") return super.cue;
    return this.zoneCue(TAKEOFF_ZONE, this.takeoffStart);
  }
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
    const timing = scoreZone({ ...TAKEOFF_ZONE, ...this.takeoffStart.timing }, this.takeoffStart.distance, this.distance);
    this.holding = false;
    if (this.distance >= JUMP.board) { this.finishAttempt("Over the board"); return; }
    if (timing.entry <= 0 || timing.hold < 0.25) { this.finishAttempt("Missed takeoff"); return; }
    const quality = timing.score / 100;
    const vx = this.speed * (0.78 + quality * 0.13), vy = 2.55 + quality * 1.05;
    const duration = (vy + Math.sqrt(vy * vy + 2 * JUMP.gravity * (JUMP.hipHeight - JUMP.landingHeight))) / JUMP.gravity;
    this.launch = { timing, runupSpeed: this.speed, vx, vy, duration,
      x: this.distance - 0.28, y: JUMP.hipHeight, boardGap: JUMP.board - this.distance, angle: Math.atan2(vy, vx) * 180 / Math.PI };
    this.athlete = { x: this.launch.x, y: this.launch.y }; this.peakHeight = this.athlete.y;
    this.world = new World({ gravity: new Vec3(0, -JUMP.gravity, 0) });
    this.body = new Body({ mass: 70, shape: new Sphere(0.2), linearDamping: 0,
      position: new Vec3(this.athlete.x, this.athlete.y, 0), velocity: new Vec3(vx, vy, 0) });
    this.world.addBody(this.body); this.phase = "flight"; this.events.push("takeoff");
  }
  step(dt) {
    if (this.phase === "flight") {
      const before = this.athlete;
      this.body.applyForce(new Vec3(this.conditions.wind * 0.08 * this.body.mass, 0, 0));
      this.world.step(dt);
      const { x, y } = this.body.position, landed = y <= JUMP.landingHeight && this.body.velocity.y < 0;
      const fraction = landed ? clamp((before.y - JUMP.landingHeight) / (before.y - y), 0, 1) : 1;
      this.time += dt * fraction; this.flightTime += dt * fraction;
      this.athlete = { x: before.x + (x - before.x) * fraction, y: landed ? JUMP.landingHeight : y };
      this.peakHeight = Math.max(this.peakHeight, this.athlete.y);
      if (landed) {
        const heels = landingHeels(this), x = Math.min(...heels.map(p => p.x));
        this.landing = { x, heels, mark: Math.floor(Math.max(0, x - JUMP.board) * 100 + 1e-8) / 100 };
        this.phase = "landing"; this.events.push("land");
      }
      return;
    }
    if (this.phase === "landing") {
      this.time += dt; this.landTime += dt;
      if (this.landTime >= 0.65) this.finishAttempt(this.landing.x < JUMP.pitStart || this.landing.x > JUMP.pitEnd ? "Outside the pit" : null);
      return;
    }
    const wasLine = this.phase === "line";
    super.step(dt);
    if (!wasLine && this.phase === "line") this.cancelInput();
    if (this.terminal) {
      this.events = this.events.filter(event => event !== "finish"); this.finishAttempt("Over the board");
    }
  }
  finishAttempt(reason) {
    this.phase = "finished"; this.holding = false; this.finishTime = this.time - this.startAt;
    this.result = { foul: !!reason, reason, mark: reason ? null : this.landing.mark,
      takeoffGrade: this.launch?.timing.grade ?? "Miss", takeoffScore: this.launch?.timing.score ?? 0,
      boardGap: this.launch?.boardGap ?? null, angle: this.launch?.angle ?? null,
      runupSpeed: this.launch?.runupSpeed ?? this.speed, flightTime: this.flightTime,
      peakHeight: this.peakHeight, time: this.finishTime, rhythmScore: this.rhythmScore,
      counts: { ...this.counts }, bestCombo: this.bestCombo, zones: this.zones.map(z => ({ ...z.result })) };
    this.events.push("finish");
  }
}
