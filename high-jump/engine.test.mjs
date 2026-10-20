import test from "node:test";
import assert from "node:assert/strict";
import { HighJumpRace, HIGH_JUMP, TAKEOFF_ZONE, normalizeBar, approachPoint } from "./engine.mjs";
import { jumperDots, getHighJumperPose, clearancePoints } from "./jumper.mjs";

const close = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
function started(height = HIGH_JUMP.defaultBar, gear = {}) { const r = new HighJumpRace(gear, height); r.press(); r.release(); return r; }
function to(r, distance, frame = 1 / 120) {
  for (let i = 0; i < 20000 && r.distance < distance && !r.terminal && !r.launch; i++)
    r.advance(Math.min(frame, Math.max(0.00001, (distance - r.distance) / Math.max(r.speed, 1))));
  assert.ok(r.distance >= distance || r.terminal);
}
function jumped(height = HIGH_JUMP.defaultBar, gear = {}, boosts = true, exit = TAKEOFF_ZONE.end, frame = 1 / 120) {
  const r = started(height, gear);
  if (boosts) for (const z of r.zones) { to(r, z.start, frame); r.press(); to(r, z.end, frame); r.release(); }
  to(r, TAKEOFF_ZONE.start, frame); r.press(); to(r, exit, frame); r.release(); return r;
}
function finish(r, frame = 1 / 120) {
  for (let i = 0; i < 5000 && !r.terminal; i++) r.advance(frame);
  assert.equal(r.terminal, true); return r;
}

test("automatic running and six fixed zones build approach momentum", () => {
  const r = started(); to(r, 5); assert.ok(r.speed > 5.5);
  assert.deepEqual(r.zones.map(z => z.start), [5, 10, 15, 20, 25, 30]);
  r.press(); to(r, 7.2); r.release(); close(r.momentum, 0.8); assert.equal(r.lastAttempt.grade, "Perfect");
  assert.ok(r.speed > r.course.baseSpeed); r.advance(0.3); assert.ok(r.momentum > 0.76);
});
test("J approach is continuous and maintains constant distance around the curve", () => {
  const join = approachPoint(24); assert.deepEqual(join, { x: 24, z: -6, heading: 0 });
  for (let d = 0; d < 38; d += 0.1) {
    const a = approachPoint(d), b = approachPoint(d + 0.01);
    close(Math.hypot(b.x - a.x, b.z - a.z), 0.01, 1e-8);
  }
  assert.ok(approachPoint(36.6).heading > 1.3);
});
test("perfect run-up clears the bar, lands on the mat and waits before finishing", () => {
  const r = jumped(); assert.equal(r.phase, "flight"); assert.equal(r.launch.timing.grade, "Perfect");
  assert.equal(r.world.gravity.y, -9.81); r.advance(0.3); assert.ok(r.athlete.y > r.launch.y);
  while (r.phase === "flight") r.advance(1 / 120);
  assert.equal(r.phase, "landing"); assert.equal(r.result, null); close(r.athlete.y, HIGH_JUMP.landingY);
  finish(r); assert.equal(r.result.cleared, true); assert.equal(r.result.mark, 1.65);
  assert.equal(r.counts.Perfect, 6); assert.ok(r.clearanceMargin > 0); assert.ok(r.landTime >= 0.7);
  assert.ok(r.events.includes("clear") && r.events.includes("land"));
});
test("run-up rhythm increases jump height and can change a failed attempt to a clearance", () => {
  const strong = finish(jumped()), baseline = finish(jumped(1.65, {}, false));
  assert.equal(strong.result.cleared, true); assert.equal(baseline.result.cleared, false);
  assert.ok(strong.peakHeight > baseline.peakHeight + 0.7);
  assert.ok(strong.result.approachSpeed > baseline.result.approachSpeed);
});
test("club gear knocks a high bar off once; elite gear can clear the selectable maximum", () => {
  const failed = finish(jumped(2.5)), elite = finish(jumped(2.5, { spikes: 2, kit: 2 }));
  assert.equal(failed.result.reason, "Bar knocked off"); assert.equal(failed.result.mark, null);
  assert.equal(failed.events.filter(e => e === "bar-hit").length, 1);
  assert.equal(elite.result.cleared, true); assert.equal(elite.result.mark, HIGH_JUMP.maxBar);
});
test("early and late takeoffs lower timing quality, while short taps cannot award a jump", () => {
  const perfect = jumped(), early = jumped(1.65, {}, true, 36), late = jumped(1.65, {}, true, 37.2);
  assert.ok(early.launch.timing.score < perfect.launch.timing.score);
  assert.ok(late.launch.timing.score < perfect.launch.timing.score);
  assert.ok(early.launch.vy < perfect.launch.vy && late.launch.vy < perfect.launch.vy);
  const tap = started(); to(tap, 34); tap.press(); tap.release();
  assert.equal(tap.result.reason, "Missed takeoff"); assert.equal(tap.launch, null);
});
test("missing the takeoff or holding throughout the approach cannot earn a clearance", () => {
  const missed = finish(started()), held = new HighJumpRace(); held.press(); finish(held);
  for (const r of [missed, held]) {
    assert.equal(r.result.reason, "Missed takeoff"); assert.equal(r.result.mark, null); assert.equal(r.launch, null);
    assert.equal(r.counts.Miss, 6);
  }
});
test("canceled blue and gold input cannot boost or jump", () => {
  const r = started(); to(r, 5); r.press(); to(r, 7.2); r.cancelInput(); r.release();
  assert.equal(r.lastAttempt.grade, "Miss"); assert.equal(r.lastAttempt.score, 0);
  to(r, 34); r.press(); to(r, 35); r.cancelInput(); r.release(); assert.equal(r.launch, null);
  assert.equal(r.takeoffStart, null); assert.equal(r.holding, false); finish(r); assert.equal(r.result.cleared, false);
});
test("flight and terminal inputs cannot trigger duplicate jumps or alter a result", () => {
  const r = jumped(); assert.equal(r.press(), false); r.release(); r.cancelInput(); finish(r);
  const result = structuredClone(r.result), time = r.time, athlete = { ...r.athlete };
  r.advance(10); r.press(); r.release(); assert.deepEqual(r.result, result); close(r.time, time); assert.deepEqual(r.athlete, athlete);
  assert.equal(r.events.filter(e => e === "finish").length, 1); assert.equal(r.events.filter(e => e === "takeoff").length, 1);
  const fresh = new HighJumpRace(); assert.equal(fresh.launch, null); assert.equal(fresh.barHit, false); assert.equal(fresh.result, null);
});
test("30 and 120 FPS agree on collisions, landing and clearance", () => {
  for (const height of [1.65, 2.5]) {
    const a = finish(jumped(height, {}, true, 36.6, 1 / 30), 1 / 30), b = finish(jumped(height));
    assert.equal(a.result.cleared, b.result.cleared); assert.equal(a.barHit, b.barHit);
    close(a.peakHeight, b.peakHeight, 0.02); close(a.elapsed, b.elapsed, 0.04);
    close(a.athlete.z, b.athlete.z, 0.04);
  }
});
test("bar heights normalize to finite five-centimeter steps within limits", () => {
  for (const value of [NaN, Infinity, -1, null, "bad"]) assert.equal(normalizeBar(value), 1.65);
  assert.equal(normalizeBar(0.2), 1.2); assert.equal(normalizeBar(99), 2.5); assert.equal(normalizeBar(1.63), 1.65);
});
test("flop leads with the head, arches the back and lifts trailing heels", () => {
  const r = jumped(); r.advance(0.4); const arch = getHighJumperPose(r);
  assert.ok(arch.head.z > arch.shoulder.z && arch.shoulder.z > arch.hip.z);
  assert.ok(arch.hip.y > arch.shoulder.y && arch.shoulder.y > arch.head.y);
  assert.ok(arch.limbs[0].heel.y < arch.hip.y);
  r.advance(0.4); const kick = getHighJumperPose(r); assert.ok(kick.limbs[0].heel.y > kick.hip.y);
});
test("body sweep catches a crossed bar and clearance waits for the trailing feet", () => {
  const r = jumped(); r.advance(0.45); const points = clearancePoints(r);
  r.barPassed = false; r.barFailed = false; r.barHit = false; r.clearanceMargin = null;
  const crossed = structuredClone(points);
  crossed[0].z = HIGH_JUMP.barZ + 0.2; crossed[0].y = points[0].y;
  r.barHeight = points[0].y; r.checkClearance(crossed);
  assert.equal(r.barFailed, true); assert.equal(r.barHit, true); assert.equal(r.barPassed, false);
  const clear = jumped();
  while (clear.phase === "flight") {
    clear.advance(1 / 240);
    if (clear.barPassed) assert.ok(clearancePoints(clear).every(p => p.z - p.radius > HIGH_JUMP.barZ));
  }
  assert.equal(clear.barPassed, true);
});
test("all animation phases stay finite and within the dot instance budget", () => {
  const r = jumped();
  while (!r.terminal) {
    const dots = jumperDots(r); assert.ok(dots.length > 80 && dots.length <= 280, String(dots.length));
    assert.ok(dots.every(p => [p.x, p.y, p.z, p.radius].every(Number.isFinite) && p.radius > 0));
    r.advance(1 / 60);
  }
});
