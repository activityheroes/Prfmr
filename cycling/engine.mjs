import { RhythmRace, longZones, clamp } from "../sprint/engine.mjs?v=sports-1";

export const CYCLING_COURSE = {
  id: "cycling", distance: 200, finishAt: 197, fatigueAt: 180, finishMove: false,
  baseSpeed: 15, rollingSpeed: 10, acceleration: 9, maxSpeeds: [21, 22.5, 24], mechanicsVersion: 1,
  zones: longZones([[30, 62], [120, 155]], 15)
};

export class CyclingRace extends RhythmRace {
  constructor(loadout = {}) {
    super(loadout, CYCLING_COURSE);
    this.pacer = null; this.draftCharge = 0; this.drafting = false; this.draftResult = null;
  }
  get draftWindow() { return this.phase === "sprint" && this.distance >= 72 && this.distance < 110 && !this.draftResult; }
  get draftGap() { return this.pacer ? this.pacer.distance - this.distance : Infinity; }
  get inSlipstream() { return this.draftGap >= 2 && this.draftGap <= 14; }
  get specialAction() {
    if (!this.draftWindow) return null;
    return { title: "SLIPSTREAM", main: this.drafting ? this.draftCharge >= 0.8 ? "RELEASE" : "TUCK &\nHOLD" : "HOLD TO\nDRAFT",
      status: !this.inSlipstream ? "OUT OF DRAFT" : this.draftCharge >= 0.8 ? "RELEASE / SLINGSHOT" : "SHELTERED / BUILDING CHARGE",
      progress: this.draftCharge, good: [0.4, 0.8], perfect: [0.8, 1] };
  }
  press() {
    if (!this.draftWindow) return super.press();
    if (this.holding) return false;
    this.holding = this.drafting = true; return true;
  }
  release() {
    if (!this.drafting) return super.release();
    this.finishDraft(false);
  }
  cancelInput() { this.drafting = false; this.draftCharge = 0; super.cancelInput(); }
  finishDraft(late) {
    const charge = this.inSlipstream ? this.draftCharge : 0;
    const gain = late ? 0 : charge * this.stats.baseSpeed * 0.12;
    this.draftResult = { grade: late ? "Late" : charge >= 0.8 ? "Perfect" : charge >= 0.4 ? "Good" : "Early", charge, gain };
    this.speed = Math.min(this.speedLimit, this.speed + gain);
    this.temporaryBoost += gain; this.burstRemaining = Math.max(this.burstRemaining, 2);
    this.peakSpeed = Math.max(this.peakSpeed, this.speed);
    this.drafting = this.holding = false; this.events.push({ type: "draft", result: this.draftResult });
  }
  step(dt) {
    super.step(dt);
    if (!this.pacer && this.distance >= 68) this.pacer = { distance: this.distance + 7, speed: Math.max(this.speed, this.stats.baseSpeed) };
    if (this.pacer) this.pacer.distance += this.pacer.speed * dt;
    if (this.drafting) {
      this.draftCharge = clamp(this.draftCharge + (this.inSlipstream ? dt / 1.2 : -dt), 0, 1);
      if (this.distance >= 110) this.finishDraft(true);
    }
    if (this.result) this.result.drafting = this.draftResult ?? { grade: "Miss", charge: 0, gain: 0 };
  }
}
