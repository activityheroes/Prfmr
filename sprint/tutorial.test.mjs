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
import { createDemo, advanceDemo, LESSONS } from "./tutorial-demo.mjs";

for (const Race of [SprintRace, CyclingRace, SwimmingRace, HurdlesRace, SpeedSkatingRace, BiathlonRace,
  JavelinRace, LongJumpRace, PoleVaultRace, HighJumpRace, SkiJumpRace]) {
  test(`${Race.name}: all lessons demonstrate real timing, manual Flame, and a valid finish`, () => {
    const live = new Race(); assert.ok(LESSONS[live.course.id]);
    for (const lesson of [0, 1, 2]) {
      const demo = createDemo(() => new Race(), lesson), r = demo.race;
      if (lesson === 1) { assert.equal(r.flameReady, true); assert.equal(r.flameCount, 0); }
      for (let i = 0; i < 6000 && demo.completedAt === null; i++) advanceDemo(demo, 1 / 60);
      assert.notEqual(demo.completedAt, null);
      if (lesson === 0) assert.equal(r.zones[0].result.grade, "Perfect");
      if (lesson === 1) assert.equal(r.flameCount, 1);
      if (lesson === 2) { assert.ok(r.terminal); assert.ok(!r.result.foul && r.result.cleared !== false); }
      assert.equal(r.meetTicket, undefined);
    }
    assert.equal(live.phase, "ready"); assert.equal(live.distance, 0);
  });
}
