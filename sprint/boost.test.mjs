import test from "node:test";
import assert from "node:assert/strict";
import { RhythmRace, SprintRace, SPRINT_COURSE, MODES } from "./engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { SpeedSkatingRace } from "../speed-skating/engine.mjs";
import { BiathlonRace } from "../biathlon/engine.mjs";
import { HurdlesRace } from "../hurdles/engine.mjs";
import { JavelinRace } from "../javelin/engine.mjs";
import { PoleVaultRace } from "../pole-vault/engine.mjs";
import { LongJumpRace } from "../long-jump/engine.mjs";
import { HighJumpRace } from "../high-jump/engine.mjs";
import { SkiJumpRace } from "../ski-jumping/engine.mjs";

const close = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function start(Race = SprintRace) { const r = new Race(); r.press(); r.release(); return r; }
function to(r, d) {
  for (let i = 0; i < 50000 && r.distance < d && !r.terminal; i++) r.advance(Math.min(1 / 120, Math.max(1e-6, (d - r.distance) / Math.max(1, r.speed))));
  assert.ok(r.distance >= d, "Reached zone boundary");
}
function zone(r, grade) {
  const z = r.nextZone; to(r, z.start); r.press(); to(r, z.end);
  if (grade) r.resolveZone(z, grade);
  r.release(); return z.result;
}

test("Good, Great and Perfect create visible, sustained increases in real speed", () => {
  let last = 0;
  for (const grade of ["Good", "Great", "Perfect"]) {
    const r = start(), result = zone(r, grade), initial = r.speed;
    assert.ok(result.speedGain > last); last = result.speedGain;
    close(result.speedAfter - result.speedBefore, result.speedGain);
    r.advance(1); assert.ok(r.speed >= initial - 0.11, "Burst must not disappear immediately");
    assert.ok(r.speed > r.stats.baseSpeed); assert.ok(r.burstRemaining > 0);
  }
});
test("three successful mixed grades enter Flow without awarding Flame", () => {
  const r = start(); for (const g of ["Good", "Great", "Good"]) zone(r, g);
  assert.equal(r.mode, "flow"); assert.equal(r.flameCount, 0); assert.equal(r.perfectStreak, 0);
  close(r.speedLimit, r.stats.maxSpeed * (1 + MODES.flowGain));
});
test("Flame requires three consecutive Perfects, refills on six and cannot be farmed", () => {
  const r = start(); zone(r); zone(r); assert.equal(r.mode, "normal");
  const third = zone(r); assert.equal(r.mode, "flame"); assert.equal(third.ignited, true);
  close(r.flameRemaining, MODES.flameDuration); assert.ok(third.speedGain / third.speedBefore > 0.15);
  for (let i = 0; i < 10; i++) { r.press(); r.release(); }
  assert.equal(r.flameCount, 1); assert.equal(r.attempts, 3);
  zone(r); zone(r); zone(r); assert.equal(r.flameCount, 2); close(r.flameRemaining, MODES.flameDuration);
});
test("Good interrupts the Perfect charge but preserves the successful streak", () => {
  const r = start(); zone(r); zone(r); zone(r, "Good");
  assert.equal(r.mode, "flow"); assert.equal(r.perfectStreak, 0);
  zone(r); zone(r); assert.equal(r.flameCount, 0); zone(r); assert.equal(r.flameCount, 1);
});
test("misses, early/late releases and canceled holds extinguish Flame", () => {
  for (const grade of ["Miss", "Early", "Late", "cancel"]) {
    const r = start(); zone(r); zone(r); zone(r);
    if (grade === "cancel") { to(r, r.nextZone.start); r.press(); r.cancelInput(); } else zone(r, grade);
    assert.equal(r.mode, "normal"); assert.equal(r.perfectStreak, 0); assert.equal(r.flameRemaining, 0);
  }
});
test("Flame expires in simulation time, then returns smoothly to Flow's ceiling", () => {
  const r = new RhythmRace({}, { ...SPRINT_COURSE, distance: 1000, finishAt: 999, fatigueAt: 990, zones: SPRINT_COURSE.zones.slice(0, 3) });
  r.press(); r.release(); zone(r); zone(r); zone(r); r.advance(6.01);
  assert.equal(r.mode, "flow"); assert.equal(r.flameRemaining, 0); r.advance(2);
  assert.ok(r.speed <= r.speedLimit); assert.ok(r.speed > r.stats.baseSpeed);
});
test("the biathlon range freezes the Flame timer and does not count shots as Perfect zones", () => {
  const r = start(BiathlonRace); zone(r); zone(r); zone(r); to(r, 200);
  assert.equal(r.phase, "shooting"); const fuel = r.flameRemaining, count = r.flameCount;
  r.advance(4); close(r.flameRemaining, fuel); assert.equal(r.flameCount, count); close(r.speed, 0);
});
test("restart begins with no mode, charge, fuel or temporary burst", () => {
  const r = start(); zone(r); zone(r); zone(r); const fresh = new SprintRace();
  assert.equal(fresh.mode, "normal"); assert.equal(fresh.flameCount, 0); assert.equal(fresh.perfectStreak, 0); close(fresh.burstRemaining, 0);
});
for (const Race of [SprintRace, CyclingRace, SwimmingRace, SpeedSkatingRace, BiathlonRace, HurdlesRace, JavelinRace, PoleVaultRace, LongJumpRace, HighJumpRace, SkiJumpRace]) {
  test(`${Race.name}: real timed zones unlock Flame while respecting the event's speed envelope`, () => {
    const r = start(Race); zone(r); zone(r); zone(r);
    assert.equal(r.counts.Perfect, 3); assert.equal(r.flameCount, 1); assert.equal(r.mode, "flame");
    assert.ok(r.speed > r.course.baseSpeed); assert.ok(r.speed <= r.speedLimit);
    if (r.finishZone || r.course.id === "hurdles") close(r.speedLimit, r.stats.maxSpeed);
  });
}
