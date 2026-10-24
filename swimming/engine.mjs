import { RhythmRace, longZones } from "../sprint/engine.mjs?v=starts-1";

export const SWIMMING_COURSE = {
  id: "swimming", distance: 50, finishAt: 49, fatigueAt: 45, finishMove: false,
  baseSpeed: 1.9, acceleration: 2.3, maxSpeeds: [2.65, 2.8, 2.95], mechanicsVersion: 1,
  // Keep the same rewards and carry-over, scaled to a swimmer's baseline speed.
  momentumScale: 1.9 / 8,
  zones: longZones([[7.5, 14], [30, 37]], 1.9)
};
export class SwimmingRace extends RhythmRace {
  constructor(loadout = {}) {
    super(loadout, SWIMMING_COURSE);
    this.turnTime = 0; this.turned = false; this.turnResult = null;
    this.diveTime = 0;
  }
  get racing() { return super.racing || this.phase === "turn" || this.phase === "dive"; }
  beginRun() {
    super.beginRun();
    if (this.startDelay !== null) { this.phase = "dive"; this.speed = 3.4; }
  }
  get specialAction() {
    if (this.phase !== "turn" && !(this.phase === "sprint" && !this.turned && this.distance >= 22.5)) return null;
    return { title: "25 M / WALL TURN", main: this.turnResult ? "PUSH-OFF\nSET" : this.phase === "turn" ? "TAP TO\nPUSH" : "WALL\nAHEAD",
      status: this.turnResult ? this.turnResult.grade.toUpperCase() + " PUSH-OFF" : this.phase === "turn" ? "TAP IN GREEN" : "APPROACHING THE WALL",
      progress: this.turnTime / 1.1, good: [(0.55 - 0.32) / 1.1, (0.55 + 0.32) / 1.1], perfect: [0.35, 0.65] };
  }
  press() {
    if (this.phase === "dive") return false;
    if (this.phase !== "turn") return super.press();
    if (this.turnResult) return false;
    const error = this.turnTime - 0.55, absolute = Math.abs(error);
    this.turnResult = { grade: absolute <= 0.165 ? "Perfect" : absolute <= 0.32 ? "Good" : error < 0 ? "Early" : "Late", error };
    this.events.push({ type: "turn-timing", result: this.turnResult }); return true;
  }
  step(dt) {
    if (this.phase === "dive") {
      this.time += dt; this.diveTime += dt; this.distance += this.speed * dt;
      if (this.diveTime >= 0.9) { this.phase = "sprint"; this.speed = Math.min(this.speedLimit, 2.6); this.temporaryBoost = 0.4; this.burstRemaining = 1; this.events.push("water-entry"); }
      this.peakSpeed = Math.max(this.peakSpeed, this.speed); return;
    }
    if (this.phase === "turn") {
      this.time += dt; this.turnTime += dt;
      if (this.turnTime >= 1.1) {
        this.turnResult ??= { grade: "Miss", error: null };
        const gain = this.turnResult.grade === "Perfect" ? 0.7 : this.turnResult.grade === "Good" ? 0.35 : 0;
        this.turned = true; this.phase = "sprint"; this.holding = false;
        this.speed = this.stats.baseSpeed + gain; this.temporaryBoost = Math.max(this.temporaryBoost, gain); this.burstRemaining = 2;
        this.events.push("push-off");
      }
      return;
    }
    super.step(dt);
    if (!this.turned && this.distance >= 25 && !this.terminal) {
      this.distance = 25; this.phase = "turn"; this.speed = 0; this.holding = false; this.events.push("turn");
    }
    if (this.result) this.result.turn = this.turnResult;
  }
}
