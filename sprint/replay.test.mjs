import test from "node:test";
import assert from "node:assert/strict";
import { SprintRace } from "./engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { HurdlesRace } from "../hurdles/engine.mjs";
import { SpeedSkatingRace } from "../speed-skating/engine.mjs";
import { BiathlonRace } from "../biathlon/engine.mjs";
import { attachReplay, advanceReplay, finishReplay, validReplay } from "./replay.mjs";
import { finishDelta } from "./race-feedback.mjs";

function to(race, distance) {
  for (let i = 0; i < 40000 && race.distance < distance && !race.terminal; i++) {
    if (race.phase === "shooting") {
      if (race.canAim && !race.holding) race.press();
      // Deliberately include misses so penalty time cannot masquerade as simulation time.
      if (race.holding && race.heldFor > 0.3) race.release();
      race.advance(1 / 120);
    } else race.advance(Math.min(1 / 120, Math.max(1e-6, (distance - race.distance) / Math.max(1, race.speed))));
  }
}
function record(Race) {
  const loadout = { band: 1, blocks: 1, spikes: 2, kit: 1 };
  const r = new Race(loadout).setWeather(42);
  attachReplay(r, gear => new Race(gear), loadout); r.advance(2.75); r.press(); r.release();
  for (const z of r.zones) { to(r, z.start); r.press(); to(r, z.end); r.release(); if (r.canActivateFlame) r.activateFlame(); }
  to(r, r.course.distance);
  assert.ok(r.terminal); return { race: r, record: finishReplay(r) };
}
for (const Race of [SprintRace, CyclingRace, SwimmingRace, HurdlesRace, SpeedSkatingRace, BiathlonRace]) {
  test(`${Race.name}: compact PB inputs replay poses, weather, gear and result at 30/120 FPS`, () => {
    const original = record(Race), saved = JSON.parse(JSON.stringify(original.record));
    assert.ok(validReplay(saved, original.race.course)); assert.ok(JSON.stringify(saved).length < 10000);
    for (const fps of [30, 120]) {
      const current = new Race().setWeather(77), playback = attachReplay(current, gear => new Race(gear), {}, saved);
      current.press(); current.release();
      // The live athlete can fall behind or finish early; play the ghost's independent clock.
      for (let i = 0; i < 600 * fps && !playback.rival.ghost.terminal; i++) {
        current.time += 1 / fps; advanceReplay(current);
      }
      const ghost = playback.rival.ghost;
      assert.ok(ghost.terminal); assert.ok(Math.abs(ghost.result.time - original.race.result.time) < 0.03);
      assert.deepEqual(ghost.counts, original.race.counts);
      assert.equal(ghost.stats.maxSpeed, original.race.stats.maxSpeed);
      assert.deepEqual(ghost.weather, original.race.weather);
      if (Race === BiathlonRace) assert.equal(ghost.penalty, original.race.penalty);
      if (Race === HurdlesRace) assert.equal(ghost.result.cleared, original.race.result.cleared);
    }
  });
}
test("no ghost before a complete run; replay cannot change the live physics or keep advancing when paused", () => {
  const saved = record(SprintRace).record, a = new SprintRace(), b = new SprintRace();
  attachReplay(a, gear => new SprintRace(gear), {}, saved);
  assert.equal(finishReplay(a), null); a.press(); a.release(); b.press(); b.release();
  for (let i = 0; i < 100; i++) { a.advance(1 / 60); b.advance(1 / 60); advanceReplay(a); }
  assert.equal(a.distance, b.distance); assert.equal(a.speed, b.speed);
  const time = a.rival.ghost.time;
  for (let i = 0; i < 60; i++) advanceReplay(a);
  assert.equal(a.rival.ghost.time, time);
});
test("invalid, outdated, huge, and malformed local records are ignored", () => {
  const { record: saved, race } = record(SprintRace);
  for (const record of [null, {}, { ...saved, signature: "old" }, { ...saved, inputs: [null] },
    { ...saved, inputs: [[0, "press"], [-1, "release"]] }, { ...saved, inputs: Array(513).fill([0, "press"]) },
    { ...saved, weather: { ...saved.weather, base: "not-weather" } }, { ...saved, loadout: { spikes: 99 } },
    { ...saved, time: Infinity }]) assert.equal(validReplay(record, race.course), false);
  const r = new SprintRace(); attachReplay(r, gear => new SprintRace(gear), {}, saved); r.press(); r.release();
  for (let i = 0; i < 300; i++) { r.press(); r.release(); } to(r, 100);
  assert.equal(finishReplay(r), null);
});
test("finish delta respects lower-is-better racing and higher-is-better field events", () => {
  assert.equal(finishDelta({ success: true, value: 9.8, previousBest: 10 }, false), "0.200 S BETTER THAN BEST");
  assert.equal(finishDelta({ success: true, value: 7, previousBest: 7.5 }, true), "0.50 M FROM BEST");
  assert.equal(finishDelta({ success: true, value: 7, previousBest: null }, true), "FIRST PERSONAL BEST");
  assert.equal(finishDelta({ success: false }, true), "NEXT ATTEMPT");
});
