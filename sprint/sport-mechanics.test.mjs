import test from "node:test";
import assert from "node:assert/strict";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { SkiJumpRace } from "../ski-jumping/engine.mjs";
import { driveDemo } from "./tutorial-demo.mjs";
import { attachReplay, advanceReplay, finishReplay } from "./replay.mjs";
import { eventPoints } from "./championship.mjs";

const start = Race => { const r = new Race(); r.press(); r.release(); return r; };
function until(r, predicate) { for (let i = 0; i < 40000 && !predicate(r) && !r.terminal; i++) r.advance(1 / 240); assert.ok(predicate(r)); }
function flight() { const r = new SkiJumpRace(); for (let i = 0; i < 10000 && !r.launch; i++) driveDemo(r, 1 / 240); assert.equal(r.phase, "flight"); return r; }

test("cycling drafting charges only in a real slipstream, then awards one slingshot", () => {
  const r = start(CyclingRace); until(r, r => r.draftWindow); r.press(); r.advance(1.15);
  assert.ok(r.draftCharge > 0.9); const speed = r.speed; r.release();
  assert.equal(r.draftResult.grade, "Perfect"); assert.ok(r.speed > speed + 1);
  const result = structuredClone(r.draftResult); r.press(); r.release(); assert.deepEqual(r.draftResult, result);
  until(r, r => r.terminal); assert.equal(r.result.drafting.grade, "Perfect");
});
test("cycling cancellation, leaving the slipstream and overholding cannot farm a boost", () => {
  for (const mode of ["cancel", "gap", "late"]) {
    const r = start(CyclingRace); until(r, r => r.draftWindow); r.press(); r.advance(0.5);
    if (mode === "cancel") { r.cancelInput(); assert.equal(r.draftCharge, 0); assert.equal(r.draftResult, null); }
    if (mode === "gap") { r.pacer.distance += 30; r.advance(0.8); r.release(); assert.equal(r.draftResult.gain, 0); }
    if (mode === "late") { until(r, r => r.distance >= 110); assert.equal(r.draftResult.grade, "Late"); assert.equal(r.draftResult.gain, 0); }
  }
});
test("swimming pauses at 25m and a single well-timed tap improves the push-off", () => {
  const perfect = start(SwimmingRace), miss = start(SwimmingRace);
  for (const r of [perfect, miss]) { until(r, r => r.phase === "turn"); assert.equal(r.distance, 25); assert.equal(r.speed, 0); r.advance(0.55); }
  perfect.press(); assert.equal(perfect.turnResult.grade, "Perfect"); assert.equal(perfect.press(), false); perfect.release();
  perfect.advance(0.56); miss.advance(0.56);
  assert.ok(perfect.turned); assert.ok(perfect.speed > miss.speed + 0.5);
  until(perfect, r => r.terminal); until(miss, r => r.terminal);
  assert.ok(perfect.result.time < miss.result.time); assert.equal(miss.result.turn.grade, "Miss");
});
test("swim early and late taps are graded, turn cannot consume Flame or duplicate results", () => {
  for (const [time, grade] of [[0.05, "Early"], [0.3, "Good"], [1, "Late"]]) {
    const r = start(SwimmingRace); until(r, r => r.phase === "turn"); r.flameReady = true;
    assert.equal(r.activateFlame(), false); r.advance(time); r.press(); r.release(); assert.equal(r.turnResult.grade, grade);
    r.cancelInput(); until(r, r => r.turned); assert.equal(r.turnResult.grade, grade);
  }
});
test("ski landing preparation rewards timing without changing the measured flight", () => {
  const good = flight(), miss = flight(); until(good, r => r.landingETA <= 0.5);
  good.press(); good.release(); assert.equal(good.landingPrep.grade, "Perfect"); assert.equal(good.press(), false);
  until(good, r => r.terminal); until(miss, r => r.terminal);
  assert.equal(good.result.landingStyle, "Telemark"); assert.equal(miss.result.landingStyle, "Parallel");
  assert.equal(good.result.mark, miss.result.mark); assert.equal(good.result.stylePoints, 20);
  assert.ok(eventPoints("ski-jumping", good.result) > eventPoints("ski-jumping", miss.result));
});
test("early ski preparation is a single committed action, not a foul or repairable by tapping", () => {
  const r = flight(); r.press(); assert.equal(r.landingPrep.grade, "Early"); r.cancelInput();
  until(r, r => r.landingETA <= 0.5); assert.equal(r.press(), false); until(r, r => r.terminal);
  assert.equal(r.result.foul, false); assert.equal(r.result.stylePoints, 0);
});
for (const Race of [CyclingRace, SwimmingRace]) test(`${Race.name}: ghost replays the extra mechanic at different frame rates`, () => {
  const r = new Race(); attachReplay(r, () => new Race(), {});
  for (let i = 0; i < 20000 && !r.terminal; i++) driveDemo(r, 1 / 120);
  const record = finishReplay(r); assert.ok(record);
  const live = new Race(); attachReplay(live, () => new Race(), {}, record); live.press(); live.release();
  for (let i = 0; i < 20000 && !live.rival.ghost.terminal; i++) { live.advance(1 / 30); advanceReplay(live); }
  const ghost = live.rival.ghost; assert.ok(ghost.terminal); assert.ok(Math.abs(ghost.result.time - record.time) < 0.02);
  const actual = ghost.result.turn ?? ghost.result.drafting, expected = r.result.turn ?? r.result.drafting;
  assert.equal(actual.grade, expected.grade);
  for (const key of Object.keys(expected).filter(key => typeof expected[key] === "number")) assert.ok(Math.abs(actual[key] - expected[key]) < 1e-8);
});
