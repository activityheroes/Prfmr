import test from "node:test";
import assert from "node:assert/strict";
import { LongJumpRace, JUMP } from "./engine.mjs";
import { getJumperPose, jumperDots, landingHeels } from "./jumper.mjs";

const close = (a, b, t = 1e-7) => assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`);
function started(gear = {}) { const r = new LongJumpRace(gear); r.press(); r.release(); return r; }
function to(r, d, frame = 1 / 120) {
  for (let i = 0; i < 20000 && r.distance < d && !r.terminal && !r.launch; i++) r.advance(Math.min(frame, Math.max(0.00001, (d - r.distance) / Math.max(r.speed, 1))));
  assert.ok(r.distance >= d || r.terminal);
}
function boost(r, i, frame = 1 / 120) { const z = r.zones[i]; to(r, z.start, frame); r.press(); to(r, z.end, frame); r.release(); }
function jumped(gear = {}, zones = true, end = 44.75, frame = 1 / 120) {
  const r = started(gear); if (zones) for (let i = 0; i < 2; i++) boost(r, i, frame);
  to(r, 40, frame); r.press(); to(r, end, frame); r.release(); return r;
}
function finish(r, frame = 1 / 120) { for (let i = 0; i < 2000 && !r.terminal; i++) r.advance(frame); assert.ok(r.terminal); return r; }

test("automatic approach uses two stationary boost strips", () => {
  const r = started(); to(r, 5); assert.ok(r.speed > 5.5); assert.deepEqual(r.zones.map(z => z.start), [6, 24]);
  boost(r, 0); assert.equal(r.lastAttempt.grade, "Perfect"); close(r.speed, 6.5 * 1.15); close(r.momentum, 2.4);
  r.advance(0.4); assert.ok(r.momentum > 0.75);
});
test("perfect run-up and takeoff complete a valid jump through Cannon flight and landing", () => {
  const r = jumped(); assert.equal(r.phase, "flight"); assert.equal(r.launch.timing.grade, "Perfect");
  assert.equal(r.world.gravity.y, -9.81); finish(r); assert.equal(r.result.foul, false);
  assert.ok(r.result.mark > 7 && r.result.mark < 9); assert.equal(r.result.counts.Perfect, 2);
  assert.ok(r.events.includes("land") && r.landTime >= 0.65); close(r.athlete.y, JUMP.landingHeight);
});
test("mark is measured from the board to the rear heel and rounded down", () => {
  const r = jumped(); while (!r.landing) r.advance(1 / 240);
  const heel = Math.min(...landingHeels(r).map(p => p.x)); close(r.landing.x, heel);
  close(r.landing.mark, Math.floor((heel - JUMP.board) * 100) / 100);
  assert.ok(heel > r.athlete.x); const mark = r.landing.mark; finish(r); close(r.result.mark, mark);
});
test("successful zones carry momentum into a longer jump", () => {
  const strong = finish(jumped()), baseline = finish(jumped({}, false));
  assert.ok(strong.result.mark > baseline.result.mark + 1.5); assert.ok(strong.result.runupSpeed > baseline.result.runupSpeed);
});
test("early takeoff loses both board distance and launch quality", () => {
  const good = finish(jumped()), early = finish(jumped({}, true, 43));
  assert.equal(early.result.foul, false); assert.ok(early.result.mark < good.result.mark - 1);
  assert.ok(early.result.boardGap > good.result.boardGap); assert.ok(early.result.takeoffScore < good.result.takeoffScore);
});
test("the board is a hard boundary regardless of timing equipment", () => {
  const r = jumped({ band: 2 }, true, 45); assert.equal(r.result.foul, true); assert.equal(r.launch, null);
  assert.equal(r.result.mark, null); assert.equal(r.result.reason, "Over the board");
});
test("continuous holding and no takeoff produce fouls without free boosts", () => {
  const held = new LongJumpRace(); held.press(); to(held, 45);
  assert.equal(held.counts.Miss, 2); assert.equal(held.result.foul, true); assert.equal(held.result.mark, null);
  const missing = started(); to(missing, 45); assert.equal(missing.result.reason, "Over the board");
});
test("canceled blue/gold input cannot award a boost or launch a jump", () => {
  const r = started(); to(r, 6); r.press(); to(r, 8.4); r.cancelInput(); r.release();
  assert.equal(r.lastAttempt.grade, "Miss"); assert.equal(r.lastAttempt.score, 0);
  to(r, 40); r.press(); to(r, 42); r.cancelInput(); r.release(); assert.equal(r.launch, null);
  to(r, 45); assert.equal(r.result.foul, true);
});
test("an extremely short takeoff hold is rejected", () => {
  const r = jumped({}, false, 40.4); assert.equal(r.result.foul, true); assert.equal(r.result.reason, "Missed takeoff"); assert.equal(r.launch, null);
});
test("flight and terminal inputs cannot create another jump or alter the mark", () => {
  const r = jumped(); assert.equal(r.press(), false); const launch = r.launch; r.release(); r.cancelInput();
  assert.equal(r.launch, launch); finish(r); const result = r.result; r.advance(10); r.press(); r.release();
  assert.equal(r.result, result); assert.equal(r.events.filter(e => e === "finish").length, 1);
});
test("30 and 120 FPS agree on distance and timing", () => {
  const a = finish(jumped({}, true, 44.75, 1 / 30), 1 / 30), b = finish(jumped());
  close(a.result.mark, b.result.mark, 0.02); close(a.result.flightTime, b.result.flightTime, 0.005); close(a.elapsed, b.elapsed, 0.02);
});
test("equipment raises jump distance without modifying other event settings", () => {
  const club = finish(jumped()), elite = finish(jumped({ spikes: 2, kit: 2 }));
  assert.ok(elite.result.mark > club.result.mark + 0.5); assert.ok(elite.peakSpeed <= 10); assert.equal(club.stats.maxSpeed, 9);
});
test("dot poses remain finite, fit the instance budget and extend the feet before contact", () => {
  const r = jumped(); let extended = false;
  while (!r.terminal) {
    const dots = jumperDots(r), pose = getJumperPose(r);
    assert.ok(dots.length > 80 && dots.length <= 260); assert.ok(dots.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y - p.radius >= -0.005));
    if (r.phase === "flight" && r.flightTime > 0.7) extended ||= pose.limbs.every(l => l.heel.x > pose.hip.x + 0.8);
    r.advance(1 / 120);
  }
  assert.equal(extended, true);
});
