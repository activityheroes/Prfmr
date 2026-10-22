import test from "node:test";
import assert from "node:assert/strict";
import { MODES } from "../sprint/engine.mjs";
import { SpeedSkatingRace, SKATING_COURSE, OVAL, ovalPoint, bendAmount } from "./engine.mjs";
import { getSkaterPose, skaterDots, SKATE_CYCLE_METERS, GLIDE, CONTACT, LEG } from "./skater.mjs";
import { beginFinish, advanceFinish, finishTravel } from "../sprint/finish.mjs";

const close = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) <= epsilon, a + " != " + b);
function started(gear = {}) { const r = new SpeedSkatingRace(gear); r.press(); r.release(); return r; }
function to(r, distance, frame = 1 / 120) {
  for (let i = 0; i < 20000 && r.distance < distance && !r.terminal; i++)
    r.advance(Math.min(frame, Math.max(0.000001, (distance - r.distance) / Math.max(1, r.speed))));
  assert.ok(r.distance >= distance || r.terminal);
}
function play(r, zone, entry = 0, exit = 0, frame = 1 / 120) {
  to(r, zone.start + entry, frame); r.press(); to(r, zone.end + exit, frame); r.release();
}
function completed(gear = {}, frame = 1 / 120) {
  const r = started(gear); for (const zone of r.zones) play(r, zone, 0, 0, frame); to(r, 500, frame); return r;
}
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test("500m auto glide completes six stationary zones without input", () => {
  const r = started(); to(r, 50); close(r.speed, 12); to(r, 500);
  close(r.distance, 500); assert.equal(r.counts.Miss, 6); assert.ok(r.finishTime > 40);
  assert.equal(r.result.dip, null); assert.equal(r.result.torsoLead, 0);
  assert.deepEqual(r.zones.map(z => [z.start, z.end]), [[55, 67], [125, 137], [205, 217], [280, 292], [355, 367], [445, 453]]);
  assert.deepEqual(r.zones.map(z => [z.start, z.end]), SKATING_COURSE.zones.map(z => [z.start, z.end]));
});
test("precise holds reward speed and momentum that carries between zones", () => {
  const r = started(); play(r, r.zones[0]); assert.equal(r.lastAttempt.grade, "Perfect"); close(r.speed, 13.8);
  assert.ok(r.momentum >= 0.8); r.advance(1); assert.ok(r.momentum > 0.69); assert.ok(r.speed > 12);
  const perfect = completed(), idle = started(); to(idle, 500);
  assert.equal(perfect.counts.Perfect, 6); assert.equal(perfect.bestCombo, 6);
  assert.ok(perfect.finishTime < idle.finishTime - 2); assert.ok(perfect.rhythmScore > 99.9);
  assert.ok(perfect.peakSpeed <= perfect.stats.maxSpeed * (1 + MODES.flameGain));
});
test("early, late, canceled and endless holds cannot award a perfect zone", () => {
  const early = started(); play(early, early.zones[0], 0, -3); assert.notEqual(early.lastAttempt.grade, "Perfect");
  const late = started(); play(late, late.zones[0], 0, 4); assert.equal(late.lastAttempt.grade, "Late");
  const canceled = started(); to(canceled, 55); canceled.press(); to(canceled, 67); canceled.cancelInput(); canceled.release();
  assert.equal(canceled.lastAttempt.score, 0); assert.equal(canceled.lastAttempt.grade, "Miss"); assert.equal(canceled.attempts, 1);
  const held = new SpeedSkatingRace(); held.press(); to(held, 500); assert.equal(held.counts.Miss, 6); close(held.momentum, 0);
});
test("skating equipment scales timing, acceleration, blade speed and endurance independently", () => {
  const club = new SpeedSkatingRace(), elite = new SpeedSkatingRace({ band: 2, blocks: 2, spikes: 2, kit: 2 });
  assert.equal(club.stats.maxSpeed, 15.6); assert.equal(elite.stats.maxSpeed, 17.2);
  assert.ok(elite.stats.acceleration > club.stats.acceleration);
  assert.ok(elite.stats.timingTolerance > club.stats.timingTolerance); assert.ok(elite.stats.endurance > club.stats.endurance);
  assert.ok(completed({ band: 2, blocks: 2, spikes: 2, kit: 2 }).finishTime < completed().finishTime);
  assert.notEqual(club.zones, elite.zones);
});
test("automatic finish has no sprint dip and results are stable across frame rates", () => {
  const r = started(); to(r, 495); assert.equal(r.phase, "line"); assert.equal(r.press(), false); assert.equal(r.dip(), false);
  to(r, 500); const result = structuredClone(r.result); r.advance(5); r.press(); r.release(); assert.deepEqual(r.result, result);
  const a = completed({}, 1 / 30), b = completed({}, 1 / 120); close(a.finishTime, b.finishTime, 0.01); assert.deepEqual(a.counts, b.counts);
});
test("400m oval is continuous in position and direction, including the lap seam", () => {
  for (const d of [OVAL.straight, 200, 200 + OVAL.straight, 400]) {
    const a = ovalPoint(d - 0.0001), b = ovalPoint(d + 0.0001);
    close(Math.hypot(a.x - b.x, a.z - b.z), 0.0002, 1e-8);
    close(Math.sin(a.heading), Math.sin(b.heading), 1e-5); close(Math.cos(a.heading), Math.cos(b.heading), 1e-5);
    close(bendAmount(d - 0.0001), bendAmount(d + 0.0001), 0.0001);
  }
  for (let d = 0; d < 800; d += 0.7) {
    const a = ovalPoint(d), b = ovalPoint(d + 0.01), lap = ovalPoint(d + 400);
    close(Math.hypot(a.x - b.x, a.z - b.z), 0.01, 1e-6); close(a.x, lap.x); close(a.z, lap.z);
    assert.ok(bendAmount(d) >= 0 && bendAmount(d) <= 1);
  }
});
test("alternating pushes always leave a blade on the ice with a distinct lifted recovery", () => {
  const r = started(); let airborne = 0;
  for (let d = 20; d < 400; d += 0.13) {
    r.distance = d; const pose = getSkaterPose(r); assert.ok(pose.limbs.some(l => l.contact));
    for (const l of pose.limbs) {
      close(gap(l.bladeBack, l.bladeFront), 0.77);
      close(l.bladeBack.y, l.bladeFront.y);
      if (l.contact) { close(l.bladeBack.y, 0.025); close(l.ankle.y, 0.15); }
      else { assert.ok(l.ankle.y >= 0.15); airborne++; }
      assert.ok(l.knee.y > l.ankle.y);
      close(gap(l.hipJoint, l.knee), LEG.thigh); close(gap(l.knee, l.ankle), LEG.shin);
    }
  }
  assert.ok(airborne > 500);
});
test("stride repeats with distance, and bends add inward lean and crossing recovery", () => {
  const r = started(); r.distance = 40; const straight = getSkaterPose(r); r.distance += SKATE_CYCLE_METERS;
  assert.deepEqual(getSkaterPose(r).limbs.map(l => l.contact), straight.limbs.map(l => l.contact));
  r.distance = 153; const turn = getSkaterPose(r);
  close(turn.turn, 1); assert.ok(turn.shoulder.z - turn.hip.z > 0.2);
  assert.ok(turn.limbs[1].ankle.z > 0); assert.ok(turn.limbs[0].ankle.z > 0);
  assert.ok(Math.abs(straight.shoulder.z - straight.hip.z) < 0.04);
});
test("glide dominates the stride, with a short lateral push and low recovery", () => {
  const r = started(), poseAt = t => { r.distance = (2 + t) * SKATE_CYCLE_METERS; return getSkaterPose(r); };
  const glide = poseAt(0.2), pushStart = poseAt(GLIDE).limbs[0], pushEnd = poseAt(CONTACT - 0.00001).limbs[0];
  assert.equal(glide.limbs[0].phase, "glide"); assert.equal(glide.limbs[1].phase, "recovery");
  assert.ok(Math.abs(glide.hip.z - glide.limbs[0].ankle.z) < 0.08);
  assert.ok(pushEnd.ankle.z - pushStart.ankle.z > 0.4);
  assert.ok(Math.abs(pushEnd.ankle.x - pushStart.ankle.x) < 0.21);
  let low = Infinity, high = -Infinity;
  for (let t = 0; t < 1; t += 0.005) {
    const p = poseAt(t); low = Math.min(low, p.hip.y); high = Math.max(high, p.hip.y);
    for (const l of p.limbs) {
      assert.ok(l.bladeBack.y <= 0.101); assert.ok(l.ankle.x > -0.31 && l.ankle.x <= 0.121);
      assert.ok(l.hand.x < p.hip.x && l.hand.y > p.hip.y);
      assert.ok(gap(p.limbs[0].hand, p.limbs[1].hand) < 0.08);
    }
    assert.ok(p.shoulder.x - p.hip.x > 0.6); close(p.shoulder.y - p.hip.y, 0.12);
  }
  assert.ok(high - low < 0.017);
});
test("blade and joint positions stay continuous through every stride boundary", () => {
  for (const base of [36, 144, 342]) for (const boundary of [0, GLIDE, 0.5, CONTACT, 0.5 + GLIDE, 0.5 + CONTACT, 1]) {
    const a = getSkaterPose({ phase: "sprint", distance: base + (boundary - 0.000001) * SKATE_CYCLE_METERS });
    const b = getSkaterPose({ phase: "sprint", distance: base + (boundary + 0.000001) * SKATE_CYCLE_METERS });
    for (let i = 0; i < 2; i++) for (const point of ["ankle", "knee", "bladeBack", "bladeFront", "hipJoint", "hand"])
      assert.ok(gap(a.limbs[i][point], b.limbs[i][point]) < 0.0001, point + " at " + boundary);
  }
});
test("all skater dots stay finite and inside the 300-instance budget for every race pose", () => {
  const r = started();
  for (let d = 0; d <= 500; d += 0.5) {
    r.distance = d; const dots = skaterDots(r);
    assert.ok(dots.length > 100 && dots.length <= 300, dots.length);
    assert.ok(dots.every(p => [p.x, p.y, p.z, p.radius].every(Number.isFinite) && p.y >= 0 && p.radius > 0));
  }
});
test("finish coasts into a two-blade celebration without changing the official result", () => {
  const r = completed(), result = structuredClone(r.result); beginFinish(r); advanceFinish(r, 1.8);
  const pose = getSkaterPose(r);
  assert.ok(finishTravel(r) > 0 && finishTravel(r) < 5);
  for (const l of pose.limbs) { close(l.bladeBack.y, 0.025); assert.ok(l.hand.y > pose.head.y); assert.equal(l.contact, true); }
  for (let i = 0; i < 100; i++) { advanceFinish(r, 0.03); assert.ok(skaterDots(r).length <= 300); }
  assert.deepEqual(r.result, result);
});
