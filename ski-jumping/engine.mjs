import { RhythmRace, scoreZone, clamp } from "../sprint/engine.mjs?v=sports-1";
import { World, Body, Vec3, Sphere } from "../javelin/cannon-es.mjs";
import { SKI_COURSE, TAKEOFF_ZONE, HILL, inrunPoint, landingPoint } from "./course.mjs?v=sports-1";
export { SKI_COURSE, TAKEOFF_ZONE, HILL } from "./course.mjs?v=sports-1";

const missed = () => ({ grade: "Miss", score: 0, entry: 0, hold: 0, release: 0 });
export class SkiJumpRace extends RhythmRace {
  constructor(loadout = {}) {
    super(loadout, SKI_COURSE);
    this.takeoffStart = null; this.takeoffTiming = null; this.takeoffAt = null;
    this.launch = null; this.athlete = null; this.landing = null;
    this.flightTime = 0; this.landTime = 0; this.peakHeight = 0;
    this.landingPrep = null;
  }
  get racing() { return super.racing || this.phase === "flight" || this.phase === "landing"; }
  get finishZone() { return TAKEOFF_ZONE; }
  get cue() { return this.phase === "line" ? this.takeoffTiming ? "armed" : this.zoneCue(TAKEOFF_ZONE, this.takeoffStart) : super.cue; }
  get landingETA() {
    if (this.phase !== "flight") return Infinity;
    const ground = landingPoint(this.athlete.x), gap = this.athlete.y - ground.y - HILL.contact;
    const closing = Math.tan(ground.angle) * this.body.velocity.x - this.body.velocity.y;
    return closing > 0.1 ? Math.max(0, gap / closing) : Infinity;
  }
  get specialAction() {
    if (this.phase !== "flight") return null;
    return { title: "LANDING PREPARATION", main: this.landingPrep ? "LANDING\nSET" : this.landingETA <= 1.4 ? "TAP TO\nPREPARE" : "IN\nFLIGHT",
      status: this.landingPrep ? this.landingPrep.grade.toUpperCase() + " PREPARATION" : this.landingETA <= 1.4 ? "TAP IN GREEN / TELEMARK" : "WAIT FOR DESCENT",
      progress: 1 - clamp(this.landingETA / 1.4, 0, 1), good: [1 - 1.1 / 1.4, 1 - 0.1 / 1.4], perfect: [1 - 0.65 / 1.4, 1 - 0.25 / 1.4] };
  }
  press() {
    if (this.phase === "flight") {
      if (this.landingPrep) return false;
      const eta = this.landingETA;
      this.landingPrep = { grade: eta >= 0.25 && eta <= 0.65 ? "Perfect" : eta >= 0.1 && eta <= 1.1 ? "Good" : eta > 0.65 ? "Early" : "Late", eta, time: this.flightTime };
      this.events.push("landing-prep"); return true;
    }
    if (this.launch || this.takeoffTiming) return false;
    if (this.phase !== "line") return super.press();
    if (this.holding) return false;
    this.holding = true; this.takeoffStart = { distance: this.distance, time: this.time, timing: this.timingWindow(TAKEOFF_ZONE) }; return true;
  }
  release() {
    if (this.phase === "line" && this.holding && this.takeoffStart) {
      this.takeoffTiming = scoreZone({ ...TAKEOFF_ZONE, ...this.takeoffStart.timing }, this.takeoffStart.distance, this.distance);
      this.takeoffAt = this.distance; this.holding = false; this.events.push("takeoff-set");
    } else super.release();
  }
  cancelInput() { this.takeoffStart = null; super.cancelInput(); }
  takeoff() {
    const timing = this.takeoffTiming ?? missed(), valid = timing.entry > 0 && timing.hold >= 0.25 && timing.grade !== "Miss";
    const quality = valid ? timing.score / 100 : 0, angle = inrunPoint(HILL.lip).angle;
    const vx = this.speed * Math.cos(angle) * (0.9 + quality * 0.1);
    const vy = this.speed * Math.sin(angle) + (valid ? 1.4 + quality * 3.5 : 0);
    this.launch = { timing, quality, valid, runupSpeed: this.speed, vx, vy, x: 0, y: HILL.contact,
      boardGap: this.takeoffAt === null ? null : HILL.lip - this.takeoffAt, angle: Math.atan2(vy, vx) * 180 / Math.PI };
    this.athlete = { x: 0, y: HILL.contact }; this.phase = "flight"; this.holding = false;
    this.finishTime = null; this.result = null;
    this.world = new World({ gravity: new Vec3(0, -HILL.gravity, 0) });
    this.body = new Body({ mass: 65, shape: new Sphere(0.1), linearDamping: 0,
      position: new Vec3(0, HILL.contact, 0), velocity: new Vec3(vx, vy, 0) });
    this.world.addBody(this.body); this.events.push("takeoff");
  }
  step(dt) {
    if (this.phase === "flight") {
      const before = this.athlete, velocity = this.body.velocity, speed = Math.hypot(velocity.x, velocity.y);
      const wind = this.conditions.wind;
      const lift = Math.min(6.5, speed * speed * (0.0065 + this.launch.quality * 0.0065)) * (1 - wind * 0.012);
      const drag = (0.0025 - this.launch.quality * 0.001) / (0.9 + this.stats.endurance * 0.1);
      this.body.applyForce(new Vec3((-drag * speed * velocity.x + wind * 0.08) * this.body.mass, lift * this.body.mass, 0));
      this.world.step(dt);
      const after = this.body.position, beforeGap = before.y - landingPoint(before.x).y - HILL.contact;
      const afterGap = after.y - landingPoint(after.x).y - HILL.contact;
      const landed = afterGap <= 0 && velocity.y < 0;
      const fraction = landed ? clamp(beforeGap / (beforeGap - afterGap), 0, 1) : 1;
      this.time += dt * fraction; this.flightTime += dt * fraction;
      const x = before.x + (after.x - before.x) * fraction, ground = landingPoint(x);
      this.athlete = { x, y: landed ? ground.y + HILL.contact : after.y };
      this.peakHeight = Math.max(this.peakHeight, this.athlete.y - ground.y);
      if (landed) {
        this.landing = { x, y: this.athlete.y, mark: Math.floor(ground.distance * 2) / 2,
          speed: Math.max(0, velocity.x), telemark: this.launch.valid && ["Perfect", "Good"].includes(this.landingPrep?.grade) };
        this.phase = "landing"; this.events.push("land");
      } else if (this.flightTime > 15 || x > 240) this.finishAttempt("Outside the landing hill");
      return;
    }
    if (this.phase === "landing") {
      this.time += dt; this.landTime += dt;
      const u = Math.min(1, this.landTime / 0.6), x = this.landing.x + this.landing.speed * 0.6 * (u - u * u / 2);
      this.athlete = { x, y: landingPoint(x).y + HILL.contact };
      if (this.landTime >= 1.25) this.finishAttempt(this.launch.valid ? null : "Missed takeoff");
      return;
    }
    const wasLine = this.phase === "line";
    super.step(dt);
    if (!wasLine && this.phase === "line") this.cancelInput();
    if (this.terminal) {
      // The shared race ends at the lip; this event continues until actual touchdown.
      this.events = this.events.filter(e => e !== "finish"); this.takeoff();
    }
  }
  finishAttempt(reason) {
    if (this.terminal) return;
    this.phase = "finished"; this.holding = false; this.finishTime = this.time - this.startAt;
    this.result = { foul: !!reason, reason, mark: reason ? null : this.landing.mark,
      takeoffGrade: this.launch.timing.grade, takeoffScore: this.launch.timing.score,
      boardGap: this.launch.boardGap, angle: this.launch.angle, runupSpeed: this.launch.runupSpeed,
      flightTime: this.flightTime, peakHeight: this.peakHeight, landingStyle: this.landing?.telemark ? "Telemark" : "Parallel",
      landingGrade: this.landingPrep?.grade ?? "Miss", stylePoints: reason ? 0 : this.landingPrep?.grade === "Perfect" ? 20 : this.landingPrep?.grade === "Good" ? 15 : this.landingPrep ? 0 : 5,
      time: this.finishTime, rhythmScore: this.rhythmScore, counts: { ...this.counts }, bestCombo: this.bestCombo,
      zones: this.zones.map(z => ({ ...z.result })) };
    this.events.push("finish");
  }
}
