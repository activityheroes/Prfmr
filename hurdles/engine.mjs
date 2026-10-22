import { RhythmRace, clamp } from "../sprint/engine.mjs?v=boost-1";
import { World, Body, Vec3, Sphere } from "../javelin/cannon-es.mjs";
import { HURDLES, HURDLES_COURSE } from "./course.mjs";
import { getHurdlerPose, collisionPoints } from "./hurdler.mjs?v=boost-1";
export { HURDLES, HURDLES_COURSE };

export class HurdlesRace extends RhythmRace {
  constructor(loadout = {}) {
    super(loadout, HURDLES_COURSE);
    this.hurdles = HURDLES.map(h => ({ ...h, status: "pending", hitAt: null }));
    this.jump = null; this.lift = 0; this.stumbleAt = null; this.lastClearAt = null;
    this.world = new World({ gravity: new Vec3(0, -9.81, 0) });
    this.body = new Body({ mass: 65, shape: new Sphere(0.03), linearDamping: 0 }); this.world.addBody(this.body);
  }
  get cleared() { return this.hurdles.filter(h => h.status === "clear").length; }
  get hits() { return this.hurdles.filter(h => h.status === "hit").length; }
  release() {
    const zone = this.activeHold;
    super.release();
    if (!zone || this.jump || this.terminal) return;
    const result = zone.result, hurdle = this.hurdles[zone.id - 1];
    if (result.canceled || result.entry <= 0 || result.hold < 0.25 || hurdle.status !== "pending") return;
    if (this.distance < hurdle.x - 4.8 || this.distance > hurdle.x - 1) return;
    const vy = 2.9 + result.score / 100 * 0.5;
    this.jump = { id: zone.id, age: 0, duration: 2 * vy / 9.81, startPose: getHurdlerPose(this) };
    this.body.position.set(0, 0, 0); this.body.velocity.set(0, vy, 0); this.lift = 0;
    this.events.push("takeoff");
  }
  hit(hurdle) {
    if (hurdle.status !== "pending") return;
    hurdle.status = "hit"; hurdle.hitAt = this.time; this.stumbleAt = this.time;
    this.speed *= 0.8; this.momentum = Math.max(0, this.momentum - 0.6); this.temporaryBoost = 0; this.combo = 0;
    this.perfectStreak = 0; this.flameRemaining = 0; this.burstRemaining = 0;
    this.events.push({ type: "hurdle-hit", id: hurdle.id });
  }
  step(dt) {
    const previous = collisionPoints(this);
    super.step(dt);
    if (this.jump) {
      this.world.step(dt); this.jump.age += dt; this.lift = Math.max(0, this.body.position.y);
      if (this.body.position.y <= 0 && this.body.velocity.y < 0) { this.jump = null; this.lift = 0; this.events.push("land"); }
    }
    const points = collisionPoints(this);
    for (const hurdle of this.hurdles) {
      if (hurdle.status !== "pending" || Math.abs(hurdle.x - this.distance) > 2) continue;
      for (let i = 0; i < points.length; i++) {
        const a = previous[i], b = points[i];
        const crossing = (a.x - hurdle.x) * (b.x - hurdle.x) <= 0 && b.x !== a.x;
        if (!crossing && Math.abs(b.x - hurdle.x) > b.radius) continue;
        const t = crossing ? clamp((hurdle.x - a.x) / (b.x - a.x), 0, 1) : 1;
        const y = a.y + (b.y - a.y) * t;
        if (y - b.radius <= hurdle.height + 0.035) { this.hit(hurdle); break; }
      }
      if (hurdle.status === "pending" && points.every(p => p.x - p.radius > hurdle.x)) {
        hurdle.status = "clear"; this.lastClearAt = this.time; this.events.push({ type: "hurdle-clear", id: hurdle.id });
      }
    }
    if (this.terminal) this.result = { ...this.result, cleared: this.cleared, hits: this.hits,
      hurdles: this.hurdles.map(h => ({ id: h.id, status: h.status })) };
  }
}
