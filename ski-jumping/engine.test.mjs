import test from "node:test";
import assert from "node:assert/strict";
import { SkiJumpRace, TAKEOFF_ZONE, SKI_COURSE, HILL } from "./engine.mjs";
import { inrunPoint, landingPoint, distancePoint } from "./course.mjs";
import { getSkierPose, skierDots } from "./skier.mjs";
import { beginFinish, advanceFinish, canShowResult } from "../sprint/finish.mjs";

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, a + " != " + b);
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function start(gear = {}) { const r = new SkiJumpRace(gear); r.press(); r.release(); return r; }
function to(r, d, frame = 1 / 120) {
  for (let n = 0; r.distance < d && !r.launch && n < 20000; n++) r.advance(Math.min(frame, Math.max(1e-6, (d - r.distance) / Math.max(1, r.speed))));
  assert.ok(r.distance >= d || r.launch);
}
function runup(r, frame = 1 / 120) {
  for (const z of r.zones) { to(r, z.start, frame); r.press(); to(r, z.end, frame); r.release(); }
}
function launch(r, offset = 0, frame = 1 / 120) {
  to(r, TAKEOFF_ZONE.start, frame); r.press(); to(r, TAKEOFF_ZONE.end + offset, frame); r.release(); to(r, HILL.lip, frame);
}
function finish(r, frame = 1 / 120) { for (let n = 0; !r.terminal && n < 10000; n++) r.advance(frame); assert.ok(r.terminal); return r; }
function perfect(gear = {}, frame = 1 / 120) { const r = start(gear); runup(r, frame); launch(r, 0, frame); return finish(r, frame); }

test("inrun has two fixed zones and a distinct gold action at the lip", () => {
  const r = start(); runup(r);
  assert.equal(r.counts.Perfect, 2); assert.equal(r.bestCombo, 2); assert.ok(r.speed > r.stats.baseSpeed);
  assert.deepEqual(r.zones.map(z => [z.start, z.end]), SKI_COURSE.zones.map(z => [z.start, z.end]));
  to(r, 125); assert.equal(r.phase, "line"); assert.equal(r.finishZone, TAKEOFF_ZONE);
});
test("release arms takeoff but flight starts at the lip, never inside a timing strip", () => {
  const r = start(); runup(r); to(r, 125); r.press(); to(r, 138); r.release();
  assert.equal(r.takeoffTiming.grade, "Perfect"); assert.equal(r.cue, "armed"); assert.equal(r.launch, null);
  assert.equal(r.press(), false); const timing = structuredClone(r.takeoffTiming); r.release(); r.cancelInput(); assert.deepEqual(r.takeoffTiming, timing);
  to(r, 140); close(r.distance, 140); close(r.athlete.x, 0, 0.001); assert.equal(r.phase, "flight");
  assert.equal(r.result, null); assert.equal(r.events.includes("finish"), false); assert.equal(r.events.filter(e => e === "takeoff").length, 1);
});
test("perfect rhythm builds a longer jump, and gear raises the performance ceiling", () => {
  const good = perfect(), unboosted = start(); launch(unboosted); finish(unboosted);
  const elite = perfect({ spikes: 2, blocks: 2, kit: 2 });
  assert.ok(good.result.mark > 90 && good.result.mark < 125); assert.ok(good.result.mark > unboosted.result.mark + 30);
  assert.ok(elite.result.mark > good.result.mark); assert.ok(elite.launch.runupSpeed <= elite.stats.maxSpeed);
  assert.equal(good.result.landingStyle, "Telemark"); assert.ok(good.peakHeight < 10);
});
test("Cannon flight applies gravity, drag and lift before touching the actual hill", () => {
  const r = start(); runup(r); launch(r); const vx = r.body.velocity.x;
  r.advance(0.6); assert.equal(r.phase, "flight"); assert.ok(r.body.velocity.x < vx); assert.ok(r.body.velocity.y < r.launch.vy);
  while (!r.landing) { assert.ok(r.athlete.y > landingPoint(r.athlete.x).y); r.advance(1 / 240); }
  close(r.landing.y, landingPoint(r.landing.x).y + HILL.contact); assert.equal(r.result, null);
  assert.equal(r.phase, "landing"); const mark = r.landing.mark; r.advance(0.4); assert.equal(r.result, null); assert.equal(r.landing.mark, mark);
  finish(r); assert.equal(r.result.mark, mark); assert.ok(r.athlete.x > r.landing.x);
});
test("missing or holding the takeoff too long shows descent and landing before no-mark results", () => {
  for (const hold of [false, true]) {
    const r = start(); if (hold) { to(r, 125); r.press(); } to(r, 140);
    assert.equal(r.phase, "flight"); assert.equal(r.launch.valid, false); assert.equal(r.result, null);
    finish(r); assert.ok(r.landing); assert.equal(r.result.foul, true); assert.equal(r.result.mark, null);
    assert.equal(r.counts.Miss, 2); assert.equal(r.result.reason, "Missed takeoff");
  }
});
test("canceled holds and short taps cannot farm a boost or a valid takeoff", () => {
  const r = start(); to(r, 20); r.press(); to(r, 28); r.cancelInput(); r.release();
  assert.equal(r.lastAttempt.score, 0); assert.equal(r.counts.Perfect, 0);
  to(r, 125); r.press(); to(r, 138); r.cancelInput(); r.release(); to(r, 140); assert.equal(r.launch.valid, false);
  const tap = start(); to(tap, 125); tap.press(); tap.release(); to(tap, 140); assert.equal(tap.launch.valid, false);
});
test("early release yields a shorter jump, and a miss cannot be repaired mid-flight", () => {
  const early = start(); runup(early); launch(early, -4); const grade = early.launch.timing.grade; finish(early);
  assert.equal(grade, "Early"); assert.ok(early.result.mark < perfect().result.mark);
  const r = start(); to(r, 140); assert.equal(r.press(), false); r.release(); r.cancelInput(); finish(r); assert.equal(r.result.mark, null);
});
test("30 and 120 FPS agree on measured landing and grading", () => {
  const a = perfect({}, 1 / 30), b = perfect({}, 1 / 120);
  close(a.result.mark, b.result.mark, 0.5); close(a.flightTime, b.flightTime, 0.015); assert.deepEqual(a.counts, b.counts);
});
test("finish clock preserves results and saves bigger marks as better", () => {
  const r = perfect(), result = structuredClone(r.result), landing = structuredClone(r.landing);
  const p = beginFinish(r, result.mark - 1); assert.equal(p.value, result.mark); assert.equal(p.personalBest, true);
  assert.equal(canShowResult(r), false); advanceFinish(r, 2); assert.equal(canShowResult(r), true);
  r.advance(10); r.press(); r.release(); advanceFinish(r, 10);
  assert.deepEqual(r.result, result); assert.deepEqual(r.landing, landing);
  assert.equal(r.events.filter(e => e === "finish").length, 1);
  const miss = finish(start()); assert.equal(beginFinish(miss).success, false);
});
test("snow profiles are continuous, the lip faces downhill, and distance labels invert measurement", () => {
  close(inrunPoint(140).x, 0); close(inrunPoint(140).y, 0); assert.ok(inrunPoint(140).angle < 0);
  for (let i = 0; i < 1400; i++) { const d = i / 10, a = inrunPoint(d), b = inrunPoint(d + 0.01); close(Math.hypot(b.x - a.x, b.y - a.y), 0.01, 1e-5); assert.ok(b.y < a.y); }
  for (let d = 0; d <= 220; d += 0.5) { const p = distancePoint(d); close(p.distance, d, 0.0001); }
  for (const x of [30, 100, 115, 180]) close(landingPoint(x - 0.0001).y, landingPoint(x + 0.0001).y, 0.001);
});
test("inrun skis stay parallel and the tuck stays low; takeoff extends before V flight", () => {
  const r = start(); to(r, 80); let p = getSkierPose(r);
  close(p.skis[0][0].z - p.skis[1][0].z, p.skis[0].at(-1).z - p.skis[1].at(-1).z);
  const tuck = gap(p.hip, p.limbs[0].ankle); launch(r); p = getSkierPose(r);
  assert.ok(gap(p.hip, p.limbs[0].ankle) > tuck + 0.25);
  r.advance(0.8); p = getSkierPose(r);
  assert.ok(p.skis[0].at(-1).z - p.skis[1].at(-1).z > 2);
  assert.ok(p.skis[0][0].z - p.skis[1][0].z < 0.25);
  assert.ok(p.head.x > p.hip.x); assert.ok(p.limbs.every(l => l.hand.x < p.shoulder.x));
});
test("landing closes the V and staggers the skis before the finish reaction", () => {
  const r = start(); runup(r); launch(r); while (!r.landing) r.advance(1 / 240);
  const p = getSkierPose(r); assert.ok(Math.abs(p.limbs[0].ankle.x - p.limbs[1].ankle.x) > 0.8);
  close(p.skis[0][0].z - p.skis[1][0].z, p.skis[0].at(-1).z - p.skis[1].at(-1).z);
  finish(r); beginFinish(r); advanceFinish(r, 2); const happy = getSkierPose(r);
  assert.ok(happy.limbs.every(l => l.hand.y > happy.head.y));
});
test("all inrun, flight, landing and reaction dots stay finite inside the instance budget", () => {
  for (const valid of [true, false]) {
    const r = start(); if (valid) { runup(r); launch(r); }
    while (!r.terminal) { r.advance(1 / 120); const dots = skierDots(r); assert.ok(dots.length > 150 && dots.length <= 340); assert.ok(dots.every(p => [p.x, p.y, p.z, p.radius].every(Number.isFinite))); }
    beginFinish(r); for (let i = 0; i < 150; i++) { advanceFinish(r, 0.03); assert.ok(skierDots(r).length <= 340); }
  }
});
