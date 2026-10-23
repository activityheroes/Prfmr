import test from "node:test";
import assert from "node:assert/strict";
import { PoleVaultRace, VAULT, PLANT_ZONE, normalizeBar } from "./engine.mjs";
import { vaulterDots, getVaulterPose, poleCurve } from "./vaulter.mjs";

const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function started(height = 3.5, gear = {}) { const r = new PoleVaultRace(gear, height); r.press(); r.release(); return r; }
function to(r, distance, frame = 1 / 120) {
  for (let i = 0; i < 20000 && r.distance < distance && !r.terminal && !r.plant; i++) r.advance(Math.min(frame, Math.max(0.00001, (distance - r.distance) / Math.max(r.speed, 1))));
  assert.ok(r.distance >= distance || r.terminal);
}
function boost(r, i, frame = 1 / 120) { const z = r.zones[i]; to(r, z.start, frame); r.press(); to(r, z.end, frame); r.release(); }
function planted(height = 3.5, gear = {}, boosts = true, exit = PLANT_ZONE.end, frame = 1 / 120) {
  const r = started(height, gear); if (boosts) for (let i = 0; i < 2; i++) boost(r, i, frame);
  to(r, PLANT_ZONE.start, frame); r.press(); to(r, exit, frame); r.release(); return r;
}
function finish(r, frame = 1 / 120) { for (let i = 0; i < 5000 && !r.terminal; i++) r.advance(frame); assert.equal(r.terminal, true); return r; }

test("two fixed zones retain automatic running and momentum rewards", () => {
  const r = started(); to(r, 5); assert.ok(r.speed > 5.5); assert.deepEqual(r.zones.map(z => z.start), [6, 24]);
  boost(r, 0); close(r.speed, 6.5 * 1.15); close(r.momentum, 2.4); r.advance(0.3); assert.ok(r.momentum > 0.76);
});
test("a perfect run-up and plant completes bend, flight, clearance and landing", () => {
  const r = planted(); assert.equal(r.phase, "vault"); assert.equal(r.plant.timing.grade, "Perfect");
  r.advance(0.5); assert.ok(r.athlete.y > r.plant.startY); assert.equal(r.phase, "vault");
  r.advance(0.51); assert.equal(r.phase, "flight"); assert.equal(r.world.gravity.y, -9.81);
  finish(r); assert.equal(r.result.cleared, true); assert.equal(r.result.mark, 3.5); assert.equal(r.counts.Perfect, 2);
  assert.ok(r.result.clearanceMargin > 0); close(r.athlete.y, VAULT.landingY); assert.ok(r.landTime >= 0.55);
  assert.ok(r.events.includes("clear") && r.events.includes("land"));
});
test("run-up momentum meaningfully increases vault height", () => {
  const strong = finish(planted()), baseline = finish(planted(3.5, {}, false));
  assert.ok(strong.peakHeight > baseline.peakHeight + 1.5); assert.ok(strong.result.approachSpeed > baseline.result.approachSpeed);
});
test("a high bar is knocked off and does not receive a clearance mark", () => {
  const r = finish(planted(5.5)); assert.equal(r.result.cleared, false); assert.equal(r.barHit, true);
  assert.equal(r.result.mark, null); assert.equal(r.result.reason, "Bar knocked off"); assert.ok(r.clearanceMargin < 0);
  assert.equal(r.events.filter(e => e === "bar-hit").length, 1);
});
test("upgraded run-up equipment can clear the maximum selectable bar", () => {
  const r = finish(planted(VAULT.maxBar, { spikes: 2, kit: 2 }));
  assert.equal(r.result.cleared, true); assert.equal(r.result.mark, VAULT.maxBar); assert.ok(r.peakSpeed <= 10);
});
test("early plant timing lowers the height and a badly missed plant aborts", () => {
  const perfect = finish(planted()), early = finish(planted(3.5, {}, true, 41.2));
  assert.ok(early.peakHeight < perfect.peakHeight); assert.ok(early.result.plantScore < perfect.result.plantScore);
  const missed = planted(3.5, {}, true, 44.4); assert.equal(missed.terminal, true); assert.equal(missed.result.reason, "Missed plant"); assert.equal(missed.plant, null);
});
test("missing or holding through the plant box cannot award a clearance", () => {
  const held = started(); to(held, 39.5); held.press(); to(held, 45); assert.equal(held.result.reason, "Missed plant");
  const continuous = new PoleVaultRace(); continuous.press(); to(continuous, 45); assert.equal(continuous.counts.Miss, 2); assert.equal(continuous.result.mark, null);
});
test("canceled blue and gold holds cannot award a boost or trigger a vault", () => {
  const r = started(); to(r, 6); r.press(); to(r, 8.4); r.cancelInput(); r.release(); assert.equal(r.lastAttempt.grade, "Miss"); assert.equal(r.lastAttempt.score, 0);
  to(r, 39.5); r.press(); to(r, 41); r.cancelInput(); r.release(); assert.equal(r.plant, null); assert.equal(r.holding, false);
  to(r, 45); assert.equal(r.result.cleared, false);
});
test("plant and flight inputs cannot create duplicate attempts", () => {
  const r = planted(); assert.equal(r.press(), false); r.release(); r.cancelInput(); r.advance(1.1); assert.equal(r.press(), false);
  finish(r); const result = r.result; r.advance(10); r.press(); r.release(); assert.equal(r.result, result);
  assert.equal(r.events.filter(e => e === "finish").length, 1);
});
test("30 and 120 FPS agree on flight, collisions and clearance", () => {
  for (const height of [3.5, 5.5]) {
    const a = finish(planted(height, {}, true, 42, 1 / 30), 1 / 30), b = finish(planted(height));
    assert.equal(a.result.cleared, b.result.cleared); assert.equal(a.result.barHit, b.result.barHit);
    close(a.peakHeight, b.peakHeight, 0.02); close(a.elapsed, b.elapsed, 0.04);
  }
});
test("bar settings are finite, quarter-meter increments within a reachable range", () => {
  assert.equal(normalizeBar(NaN), 3.5); assert.equal(normalizeBar(-1), 2.5); assert.equal(normalizeBar(100), 6); assert.equal(normalizeBar(4.13), 4.25);
});
test("pole tip stays in the box and grip stays attached throughout the bend", () => {
  const r = planted();
  for (let i = 0; i < 20; i++) {
    r.advance(0.04); const curve = poleCurve(r), pose = getVaulterPose(r);
    close(curve.start.x, VAULT.boxX); close(curve.start.y, 0.04); close(curve.end.x, pose.limbs[0].hand.x); close(curve.end.y, pose.limbs[0].hand.y);
    assert.ok(curve.control.x < (curve.start.x + curve.end.x) / 2);
  }
});
test("dot poses fit the instance budget and remain finite across every phase", () => {
  const r = planted(); let inverted = false, horizontal = false;
  while (!r.terminal) {
    const dots = vaulterDots(r), pose = getVaulterPose(r); assert.ok(dots.length > 80 && dots.length <= 260);
    assert.ok(dots.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.radius > 0));
    if (r.phase === "vault" && pose.limbs[0].ankle.y > pose.head.y) inverted = true;
    if (r.phase === "flight" && pose.head.x > pose.hip.x + 0.9) horizontal = true;
    r.advance(1 / 60);
  }
  assert.ok(inverted && horizontal);
});
