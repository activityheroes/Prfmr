import test from "node:test";
import assert from "node:assert/strict";
import { HurdlesRace, HURDLES } from "./engine.mjs";
import { getHurdlerPose, collisionPoints, hurdlerDots } from "./hurdler.mjs";
import { beginFinish, advanceFinish } from "../sprint/finish.mjs";

const close = (a, b, e = 0.02) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
function started(gear) { const r = new HurdlesRace(gear); r.press(); r.release(); return r; }
function to(r, distance, frame = 1 / 120) {
  for (let i = 0; i < 20000 && r.distance < distance && !r.terminal; i++)
    r.advance(Math.min(frame, Math.max(0.00001, (distance - r.distance) / Math.max(r.speed, 1))));
  assert.ok(r.distance >= distance || r.terminal);
}
function finish(r, frame = 1 / 120) { for (let i = 0; i < 10000 && !r.terminal; i++) r.advance(frame); assert.ok(r.terminal); return r; }
function clean(gear, frame = 1 / 120) {
  const r = started(gear);
  for (const z of r.zones) { to(r, z.start, frame); r.press(); to(r, z.end, frame); r.release(); }
  return finish(r, frame);
}

test("100m course has ten stationary hurdles with one approach zone per barrier", () => {
  const r = new HurdlesRace(); assert.equal(r.course.distance, 100); assert.equal(r.zones.length, 10);
  assert.equal(HURDLES[0].x, 13); assert.equal(HURDLES.at(-1).x, 89.5);
  HURDLES.slice(1).forEach((h, i) => assert.equal(h.x - HURDLES[i].x, 8.5));
  assert.ok(r.zones.every((z, i) => z.end < HURDLES[i].x && z.start < z.end));
});
test("baseline running finishes without input, with clipped barriers rather than a disqualification", () => {
  const r = finish(started()); assert.equal(r.hits, 10); assert.equal(r.cleared, 0);
  assert.equal(r.counts.Miss, 10); assert.equal(r.result.hits, 10); assert.equal(r.result.time, r.elapsed);
  assert.equal(r.events.filter(e => e.type === "hurdle-hit").length, 10);
});
test("perfect holds launch ten jumps, clear every hurdle and beat the baseline", () => {
  const r = clean(); assert.equal(r.cleared, 10); assert.equal(r.hits, 0); assert.equal(r.counts.Perfect, 10);
  assert.equal(r.events.filter(e => e === "takeoff").length, 10); assert.equal(r.events.filter(e => e === "land").length, 10);
  assert.ok(r.elapsed < finish(started()).elapsed - 2); assert.equal(r.result.hurdles.length, 10);
});
test("upgraded equipment still clears the barriers and improves the clock", () => {
  const elite = clean({ spikes: 2, kit: 2, blocks: 2 }); assert.equal(elite.cleared, 10);
  assert.ok(elite.elapsed < clean().elapsed); assert.ok(elite.peakSpeed <= elite.stats.maxSpeed);
});
test("one sustained hold cannot automatically jump or collect rewards", () => {
  const r = new HurdlesRace(); r.press(); finish(r);
  assert.equal(r.hits, 10); assert.equal(r.counts.Miss, 10); assert.equal(r.events.includes("takeoff"), false);
});
test("canceled and short holds do not launch a jump", () => {
  for (const cancel of [true, false]) {
    const r = started(); to(r, r.zones[0].start); r.press();
    if (cancel) { to(r, r.zones[0].end); r.cancelInput(); }
    r.release(); assert.equal(r.jump, null); assert.equal(r.lastAttempt.grade, "Miss");
    to(r, 14); assert.equal(r.hurdles[0].status, "hit");
  }
});
test("an overheld zone does not launch on automatic resolution or a stale release", () => {
  const r = started(), z = r.zones[0]; to(r, z.start); r.press(); to(r, 13); r.release();
  assert.equal(r.jump, null); assert.equal(r.lastAttempt.grade, "Late"); assert.equal(r.hurdles[0].status, "hit");
});
test("repeated input cannot create a second jump for the same hurdle", () => {
  const r = started(), z = r.zones[0]; to(r, z.start); r.press(); to(r, z.end); r.release();
  const jump = r.jump; r.release(); r.press(); r.release(); assert.equal(r.jump, jump);
  assert.equal(r.events.filter(e => e === "takeoff").length, 1);
});
test("a hit reduces speed and momentum exactly once for that hurdle", () => {
  const r = started(); to(r, 10); r.momentum = 1; r.speed = 9;
  r.hit(r.hurdles[0]); close(r.speed, 7.2); close(r.momentum, 0.4);
  r.hit(r.hurdles[0]); close(r.speed, 7.2); assert.equal(r.hits, 1);
});
test("lead leg extends and trailing knee folds sideways during a gravity-driven jump", () => {
  const r = started(), z = r.zones[0]; to(r, z.start); r.press(); to(r, z.end); r.release();
  r.advance(0.25); const p = getHurdlerPose(r);
  assert.ok(r.lift > 0.4); assert.equal(r.world.gravity.y, -9.81);
  assert.ok(p.limbs[0].ankle.x > p.hip.x + 0.9); assert.ok(p.limbs[1].knee.z < -0.3);
  assert.ok(p.limbs[1].ankle.x < p.hip.x - 0.7);
  r.advance(0.6); assert.equal(r.jump, null); assert.equal(r.lift, 0);
});
test("clearance waits until every sampled body point has passed the hurdle", () => {
  const r = started(), z = r.zones[0]; to(r, z.start); r.press(); to(r, z.end); r.release();
  while (r.hurdles[0].status === "pending") r.advance(1 / 240);
  assert.equal(r.hurdles[0].status, "clear"); assert.ok(collisionPoints(r).every(p => p.x - p.radius > 13));
});
test("30 and 120 FPS agree for clean and unattended races", () => {
  for (const fn of [frame => clean({}, frame), frame => finish(started(), frame)]) {
    const a = fn(1 / 30), b = fn(1 / 120); close(a.elapsed, b.elapsed, 0.04);
    assert.equal(a.cleared, b.cleared); assert.equal(a.hits, b.hits); assert.deepEqual(a.counts, b.counts);
  }
});
test("results freeze, celebration retains the mark and restart has fresh barriers", () => {
  const r = clean(), result = structuredClone(r.result); beginFinish(r); advanceFinish(r, 4);
  r.advance(20); r.press(); r.release(); assert.deepEqual(r.result, result);
  assert.equal(r.events.filter(e => e === "finish").length, 1);
  const fresh = new HurdlesRace(); assert.equal(fresh.hits, 0); assert.equal(fresh.jump, null);
  assert.ok(fresh.hurdles.every(h => h.status === "pending" && h.hitAt === null));
});
test("running, clearance and reaction dots stay finite within the mesh budget", () => {
  const r = started(), z = r.zones[0]; to(r, z.start); r.press(); to(r, z.end); r.release();
  for (let i = 0; i < 180; i++) {
    const dots = hurdlerDots(r); assert.ok(dots.length > 80 && dots.length <= 280);
    assert.ok(dots.every(p => [p.x, p.y, p.z, p.radius].every(Number.isFinite))); r.advance(1 / 120);
  }
  finish(r); beginFinish(r);
  for (let i = 0; i < 200; i++) { advanceFinish(r, 1 / 60); assert.ok(hurdlerDots(r).every(p => p.y >= 0 && Number.isFinite(p.x))); }
});
