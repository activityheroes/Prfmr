import test from "node:test";
import assert from "node:assert/strict";
import { SprintRace } from "./engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { HurdlesRace } from "../hurdles/engine.mjs";
import { SpeedSkatingRace } from "../speed-skating/engine.mjs";
import { BiathlonRace } from "../biathlon/engine.mjs";
import { JavelinRace } from "../javelin/engine.mjs";
import { LongJumpRace } from "../long-jump/engine.mjs";
import { PoleVaultRace } from "../pole-vault/engine.mjs";
import { HighJumpRace } from "../high-jump/engine.mjs";
import { SkiJumpRace } from "../ski-jumping/engine.mjs";
import { SwimmingScene } from "../swimming/scene.mjs";
import { driveDemo, createDemo, advanceDemo } from "./tutorial-demo.mjs";
import { attachReplay, finishReplay, advanceReplay, validReplay } from "./replay.mjs";

const races = [SprintRace, CyclingRace, SwimmingRace, HurdlesRace, SpeedSkatingRace, BiathlonRace,
  JavelinRace, LongJumpRace, PoleVaultRace, HighJumpRace, SkiJumpRace];
const close = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, a + " != " + b);
for (const Race of races) {
  test(`${Race.name}: countdown holds position, rejects early releases, and times reaction from the gun`, () => {
    const r = new Race().enableStart(0.8); r.press(); r.advance(1.2);
    assert.equal(r.startCue, "2"); assert.equal(r.distance, 0); assert.equal(r.speed, 0);
    r.release(); assert.equal(r.phase, "false-start"); assert.equal(r.result, null); assert.equal(r.terminal, false);
    r.press(); r.advance(3.5); assert.equal(r.startCue, "SET"); assert.equal(r.distance, 0);
    r.advance(0.42); assert.equal(r.startCue, "GO!"); close(r.elapsed, 0.12); r.release();
    assert.equal(r.reaction.grade, "Perfect"); close(r.reaction.seconds, 0.12);
    assert.equal(r.phase, Race === SwimmingRace ? "dive" : "sprint");
    for (let i = 0; i < 30000 && !r.terminal; i++) driveDemo(r, 1 / 120);
    assert.ok(r.terminal); assert.equal(r.result.reaction.grade, "Perfect"); assert.ok(!r.result.foul);
  });
  test(`${Race.name}: canceling a countdown resets safely without launching or consuming an attempt`, () => {
    const r = new Race().enableStart(0.8); r.press(); r.advance(3.9); r.cancelInput();
    assert.equal(r.phase, "ready"); assert.equal(r.elapsed, 0); assert.equal(r.distance, 0); assert.equal(r.attempts, 0);
    assert.equal(r.reaction, null); assert.equal(r.result, null); assert.equal(r.startGate, null);
    const demo = createDemo(() => new Race(), -1);
    for (let i = 0; i < 1000 && demo.completedAt === null; i++) advanceDemo(demo, 1 / 60);
    assert.equal(demo.race.reaction.grade, "Perfect"); assert.notEqual(demo.completedAt, null);
  });
}
test("quick reactions improve launch acceleration, while late reaction is part of the race clock", () => {
  const run = delay => { const r = new SprintRace().enableStart(0.8); r.press(); r.advance(3.8 + delay); r.release(); r.advance(0.5); return r; };
  const fast = run(0.1), slow = run(0.7);
  assert.ok(fast.speed > slow.speed); close(slow.elapsed - fast.elapsed, 0.6);
  assert.equal(slow.reaction.grade, "Late");
});
test("pool zones and their marker bands belong to only one length, with no completed-zone duplicates", () => {
  const r = new SwimmingRace(), visible = zone => SwimmingScene.prototype.isZoneVisible(zone, r);
  assert.deepEqual(r.zones.map(visible), [true, false]);
  r.turned = true; assert.deepEqual(r.zones.map(visible), [false, true]);
  r.zones[1].status = "done"; assert.deepEqual(r.zones.map(visible), [false, false]);
});
test("swimmer leaves the starting block, completes one dive, then preserves the 25m wall turn", () => {
  const r = new SwimmingRace().enableStart(0.8); r.press(); r.advance(3.92); r.release();
  assert.equal(r.phase, "dive"); r.advance(0.4); assert.ok(r.distance > 1 && r.distance < 2); assert.equal(r.press(), false);
  r.advance(0.51); assert.equal(r.phase, "sprint"); assert.ok(r.distance < r.zones[0].start);
  for (let i = 0; i < 20000 && r.phase !== "turn"; i++) r.advance(1 / 240);
  assert.equal(r.distance, 25); r.advance(0.55); r.press(); r.release(); r.advance(0.56);
  assert.ok(r.turned); assert.equal(r.turnResult.grade, "Perfect");
});
for (const Race of [SprintRace, SwimmingRace]) test(`${Race.name}: PB replay preserves false-start retries, gun delay and reaction`, () => {
  const r = new Race().enableStart(0.9); attachReplay(r, () => new Race(), {});
  r.press(); r.advance(1); r.release(); r.advance(0.3); r.press(); r.advance(4.02); r.release();
  for (let i = 0; i < 20000 && !r.terminal; i++) driveDemo(r, 1 / 120);
  const record = finishReplay(r); assert.ok(validReplay(record, r.course));
  const live = new Race().enableStart(1.3); attachReplay(live, () => new Race(), {}, record); live.press();
  for (let i = 0; i < 20000 && !live.rival.ghost.terminal; i++) { live.time += 1 / 30; advanceReplay(live); }
  const ghost = live.rival.ghost; assert.ok(ghost.terminal); close(ghost.reaction.seconds, r.reaction.seconds);
  close(ghost.result.time, r.result.time, 0.02); assert.deepEqual(ghost.counts, r.counts);
});
