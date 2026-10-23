import { RhythmRace, scoreZone, clamp, longZones } from "../sprint/engine.mjs?v=weather-1";
import { World, Body, Vec3, Sphere, Box } from "../javelin/cannon-es.mjs";
import { clearancePoints } from "./vaulter.mjs?v=weather-1";

export const VAULT_COURSE = {
  id: "pole-vault", distance: 45, finishAt: 39, fatigueAt: 43, finishMove: false,
  baseSpeed: 6.5, acceleration: 6, maxSpeeds: [9, 9.5, 10],
  zones: longZones([[6, 16], [24, 35]], 6.5)
};
export const PLANT_ZONE = { start: 39.5, end: 42, edgeWindow: 1, perfectEdge: 0.15 };
export const VAULT = { boxX: 45, barX: 46.6, poleTime: 1, gravity: 9.81, landingY: 0.98, minBar: 2.5, maxBar: 6 };
export const normalizeBar = value => clamp(Math.round((Number(value) || 3.5) * 4) / 4, VAULT.minBar, VAULT.maxBar);

export class PoleVaultRace extends RhythmRace {
  constructor(loadout = {}, height = 3.5) {
    super(loadout, VAULT_COURSE);
    this.barHeight = normalizeBar(height); this.plantStart = null; this.plant = null;
    this.vaultTime = 0; this.flightTime = 0; this.landTime = 0;
    this.athlete = null; this.peakHeight = 0; this.barHit = false; this.barFailed = false;
    this.barHitAt = null; this.barPassed = false; this.clearanceMargin = null;
  }
  get racing() { return super.racing || ["vault", "flight", "landing"].includes(this.phase); }
  get finishZone() { return PLANT_ZONE; }
  get cue() {
    if (this.phase !== "line") return super.cue;
    return this.zoneCue(PLANT_ZONE, this.plantStart);
  }
  press() {
    if (["vault", "flight", "landing"].includes(this.phase)) return false;
    if (this.phase !== "line") return super.press();
    if (this.holding) return false;
    this.holding = true; this.plantStart = { distance: this.distance, time: this.time, timing: this.timingWindow(PLANT_ZONE) }; return true;
  }
  release() {
    if (this.phase === "line" && this.holding && this.plantStart) this.plantPole();
    else super.release();
  }
  cancelInput() { this.plantStart = null; super.cancelInput(); }
  plantPole() {
    const window = this.plantStart.timing;
    const timing = scoreZone({ ...PLANT_ZONE, ...window }, this.plantStart.distance, this.distance);
    this.holding = false;
    if (timing.entry <= 0 || timing.hold < 0.25 || Math.abs(timing.releaseError) > window.edgeWindow) {
      this.finishAttempt("Missed plant"); return;
    }
    const quality = 0.65 + timing.score / 100 * 0.35;
    const targetPeak = 1.65 + this.speed ** 2 / (2 * VAULT.gravity) * 1.12 * quality;
    this.plant = { timing, speed: this.speed, startX: this.distance - 0.48, startY: 1.35,
      launchY: Math.max(1.7, targetPeak - 4.5 ** 2 / (2 * VAULT.gravity)) };
    this.athlete = { x: this.plant.startX, y: this.plant.startY };
    this.peakHeight = this.athlete.y; this.phase = "vault"; this.events.push("plant");
  }
  leavePole() {
    this.phase = "flight";
    this.world = new World({ gravity: new Vec3(0, -VAULT.gravity, 0) });
    this.body = new Body({ mass: 70, shape: new Sphere(0.34), linearDamping: 0,
      position: new Vec3(this.athlete.x, this.athlete.y, 0), velocity: new Vec3(3.2, 4.5, 0) });
    const bar = new Body({ mass: 0, shape: new Box(new Vec3(0.045, 0.035, 1.6)),
      position: new Vec3(VAULT.barX, this.barHeight, 0), collisionResponse: false });
    this.body.addEventListener("collide", event => { if (event.body === bar) this.hitBar(); });
    this.world.addBody(this.body); this.world.addBody(bar); this.events.push("flight");
  }
  hitBar() {
    if (!this.barHit) { this.barHit = true; this.barHitAt = this.time; this.events.push("bar-hit"); }
    this.barFailed = true;
  }
  checkClearance(previous = []) {
    // Check the visible limbs as well as Cannon's torso collider.
    for (const [i, point] of clearancePoints(this).entries()) {
      const dx = Math.abs(point.x - VAULT.barX), before = previous[i];
      const crossing = before && before.x < VAULT.barX && point.x >= VAULT.barX;
      if (dx > point.radius && !crossing) continue;
      const y = crossing ? before.y + (point.y - before.y) * (VAULT.barX - before.x) / (point.x - before.x) : point.y;
      const radius = crossing ? point.radius : Math.sqrt(Math.max(0, point.radius ** 2 - dx ** 2));
      const margin = y - radius - this.barHeight;
      this.clearanceMargin = Math.min(this.clearanceMargin ?? Infinity, margin);
      if (margin < 0) {
        this.barFailed = true;
        if (y + radius >= this.barHeight) this.hitBar();
      }
    }
    if (this.athlete.x > VAULT.barX + 1.4 && !this.barPassed) {
      this.barPassed = true; this.events.push(this.barFailed ? "missed-bar" : "clear");
    }
  }
  step(dt) {
    if (this.phase === "vault") {
      const step = Math.min(dt, VAULT.poleTime - this.vaultTime);
      this.time += step; this.vaultTime += step;
      const u = this.vaultTime / VAULT.poleTime;
      this.athlete.x = this.plant.startX + (VAULT.boxX + 0.2 - this.plant.startX) * Math.sin(u * Math.PI / 2);
      this.athlete.y = this.plant.startY + (this.plant.launchY - this.plant.startY) * (1 - Math.cos(u * Math.PI / 2));
      this.peakHeight = Math.max(this.peakHeight, this.athlete.y);
      if (u >= 1 - 1e-9) this.leavePole();
      return;
    }
    if (this.phase === "flight") {
      const before = this.athlete, beforePoints = clearancePoints(this);
      this.world.step(dt);
      const { x, y } = this.body.position;
      const landed = y <= VAULT.landingY && this.body.velocity.y < 0;
      const fraction = landed ? clamp((before.y - VAULT.landingY) / (before.y - y), 0, 1) : 1;
      this.time += dt * fraction; this.flightTime += dt * fraction;
      this.athlete = { x: before.x + (x - before.x) * fraction, y: landed ? VAULT.landingY : y };
      this.peakHeight = Math.max(this.peakHeight, this.athlete.y); this.checkClearance(beforePoints);
      if (landed) { this.phase = "landing"; this.events.push("land"); }
      return;
    }
    if (this.phase === "landing") {
      this.landTime += dt; this.time += dt;
      if (this.landTime >= 0.55) this.finishAttempt(this.barPassed && !this.barFailed ? null : this.barHit ? "Bar knocked off" : "Below the bar");
      return;
    }
    const wasLine = this.phase === "line";
    super.step(dt);
    if (!wasLine && this.phase === "line") this.cancelInput();
    if (this.terminal) {
      this.events = this.events.filter(event => event !== "finish"); this.finishAttempt("Missed plant");
    }
  }
  finishAttempt(reason) {
    this.phase = "finished"; this.holding = false; this.finishTime = this.time - this.startAt;
    this.result = { cleared: reason === null, reason, mark: reason === null ? this.barHeight : null,
      barHeight: this.barHeight, peakHeight: this.peakHeight, plantGrade: this.plant?.timing.grade ?? "Miss",
      plantScore: this.plant?.timing.score ?? 0, approachSpeed: this.plant?.speed ?? this.speed,
      clearanceMargin: this.clearanceMargin, barHit: this.barHit, time: this.finishTime,
      rhythmScore: this.rhythmScore, counts: { ...this.counts }, bestCombo: this.bestCombo,
      zones: this.zones.map(zone => ({ ...zone.result })) };
    this.events.push("finish");
  }
}
