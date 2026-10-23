import { RhythmRace } from "../sprint/engine.mjs?v=zones-2";
import { BIATHLON_COURSE, RANGE, aimAt, terrainFactor } from "./course.mjs?v=zones-2";
export { BIATHLON_COURSE, RANGE };

export class BiathlonRace extends RhythmRace {
  constructor(loadout = {}) {
    super(loadout, BIATHLON_COURSE);
    this.rangeVisited = false; this.rangeAt = null; this.rangeDoneAt = null;
    this.aimStartedAt = null; this.reloadUntil = 0; this.penalty = 0; this.shots = []; this.lastShot = null;
  }
  get racing() { return super.racing || this.phase === "shooting"; }
  get elapsed() { return this.finishTime ?? super.elapsed + this.penalty; }
  get hits() { return this.shots.filter(shot => shot.hit).length; }
  get rangeAge() { return this.rangeAt === null ? 0 : this.time - this.rangeAt; }
  get heldFor() { return this.aimStartedAt === null ? 0 : this.time - this.aimStartedAt; }
  get aim() { return aimAt(this.rangeAge, this.heldFor, this.stats.timingTolerance); }
  get canAim() { return this.phase === "shooting" && this.rangeAge >= RANGE.settle && this.time >= this.reloadUntil && this.shots.length < RANGE.targets; }
  get canHit() { return this.holding && this.heldFor >= RANGE.minimumHold && this.aim.centered; }
  press() {
    if (this.phase !== "shooting") return super.press();
    if (!this.canAim || this.holding) return false;
    this.holding = true; this.aimStartedAt = this.time; return true;
  }
  release() {
    if (this.phase !== "shooting") return super.release();
    if (!this.holding) return;
    if (this.heldFor >= RANGE.minimumHold && this.canAim) {
      const shot = { id: this.shots.length + 1, hit: this.aim.centered, perfect: this.aim.error < 0.16, error: this.aim.error, time: this.time };
      this.shots.push(shot); this.lastShot = shot;
      if (!shot.hit) this.penalty += RANGE.penalty;
      this.reloadUntil = this.time + RANGE.reload;
      this.events.push({ type: "shot", shot });
      if (this.shots.length === RANGE.targets) this.rangeDoneAt = this.time;
    } else this.events.push({ type: "steady" });
    this.holding = false; this.aimStartedAt = null;
  }
  cancelInput() {
    if (this.phase !== "shooting") return super.cancelInput();
    this.holding = false; this.aimStartedAt = null;
  }
  step(dt) {
    if (this.phase === "shooting") {
      this.time += dt;
      if (this.rangeDoneAt !== null && this.time - this.rangeDoneAt >= RANGE.depart) {
        this.phase = "sprint"; this.speed = this.stats.baseSpeed * 0.55;
        this.events.push({ type: "range-exit" });
      }
      return;
    }
    const beforeDistance = this.distance, beforeTime = this.time, baseline = this.stats.baseSpeed;
    // Reuse the shared rhythm physics; only the terrain's target pace changes.
    this.stats.baseSpeed = baseline * terrainFactor(this.distance);
    try { super.step(dt); } finally { this.stats.baseSpeed = baseline; }
    if (!this.rangeVisited && this.distance >= RANGE.distance) {
      const fraction = (RANGE.distance - beforeDistance) / (this.distance - beforeDistance);
      const crossingTime = beforeTime + dt * fraction;
      this.distance = RANGE.distance; this.rangeVisited = true; this.rangeAt = crossingTime;
      super.cancelInput(); this.phase = "shooting"; this.speed = 0; this.temporaryBoost = 0;
      this.events.push({ type: "range-enter" });
    }
    if (this.terminal && this.result.courseTime === undefined) {
      const courseTime = this.finishTime;
      this.finishTime += this.penalty;
      Object.assign(this.result, { time: this.finishTime, courseTime, penalty: this.penalty, hits: this.hits,
        shots: this.shots.map(shot => ({ ...shot })) });
    }
  }
}
