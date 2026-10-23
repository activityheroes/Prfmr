import test from "node:test";
import assert from "node:assert/strict";
import { SprintRace, releaseBands, scoreZone, getTimingWindow } from "./engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { JavelinRace } from "../javelin/engine.mjs";
import { PoleVaultRace } from "../pole-vault/engine.mjs";
import { LongJumpRace } from "../long-jump/engine.mjs";
import { HighJumpRace } from "../high-jump/engine.mjs";
import { SkiJumpRace } from "../ski-jumping/engine.mjs";
import { SpeedSkatingRace } from "../speed-skating/engine.mjs";
import { BiathlonRace } from "../biathlon/engine.mjs";
import { HurdlesRace } from "../hurdles/engine.mjs";
import { readEventSave, writeEventSave } from "./save.mjs";

const races = [SprintRace, CyclingRace, SwimmingRace, JavelinRace, PoleVaultRace,
  LongJumpRace, HighJumpRace, SkiJumpRace, SpeedSkatingRace, BiathlonRace];
for (const Race of races) {
  test(`${Race.name}: two long holds with room for recovery and the final action`, () => {
    const r = new Race(); assert.equal(r.zones.length, 2);
    for (const z of r.zones) {
      assert.ok(z.longHold);
      assert.ok((z.end - z.start) / r.stats.baseSpeed >= 1);
      assert.ok(z.end + r.timingWindow(z).edgeWindow < (r.finishZone?.start ?? r.course.finishAt));
    }
    assert.ok(r.zones[0].end + r.timingWindow(r.zones[0]).edgeWindow < r.zones[1].start);
    if (r.course.id === "biathlon") assert.ok(r.zones[0].end < 200 && r.zones[1].start > 200);
  });
  test(`${Race.name}: visible release bands match actual grades, including imperfect entries and gear`, () => {
    const r = new Race();
    for (const base of [...r.zones, ...(r.finishZone ? [r.finishZone] : [])]) {
      for (const tolerance of [1, 1.3]) for (const entry of [0, 0.2, 0.7, 1.01]) {
        const z = { ...base, ...getTimingWindow(base, r.stats.maxSpeed, tolerance) };
        const press = z.start + entry * z.edgeWindow, hardEnd = base.id == null ? r.course.distance : Infinity;
        const bands = releaseBands(z, press, hardEnd);
        for (let i = 0; i < 101; i++) {
          const d = bands.bad.start + (bands.bad.end - bands.bad.start) * i / 100;
          const grade = d < hardEnd ? scoreZone(z, press, d).grade : "Foul";
          const contains = b => b && d > b.start + 1e-5 && d < b.end - 1e-5;
          if (contains(bands.perfect)) assert.equal(grade, "Perfect");
          else if (contains(bands.good)) assert.ok(["Perfect", "Great", "Good"].includes(grade));
          else if (Math.abs(d - (bands.good?.start ?? 0)) > 1e-5 && Math.abs(d - (bands.good?.end ?? 0)) > 1e-5)
            assert.ok(!["Perfect", "Great", "Good"].includes(grade));
        }
        if (entry > 1) assert.equal(bands.perfect, null);
      }
    }
  });
}

test("Hurdles retains one manually timed hold and release per barrier", () => {
  const r = new HurdlesRace(); assert.equal(r.zones.length, 10);
  assert.ok(r.zones.every(z => !z.longHold)); assert.equal(r.hurdles.length, 10);
});
test("new course records preserve old saves and equipment without comparing old bests", () => {
  const old = globalThis.localStorage, data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  try {
    const legacy = { best: 9.7, loadout: { spikes: 2 }, barHeight: 4 };
    data.set("race", JSON.stringify(legacy));
    assert.deepEqual(readEventSave("race"), { ...legacy, best: null });
    writeEventSave("race", { ...legacy, best: 10.5 });
    assert.equal(readEventSave("race").best, 10.5);
    assert.deepEqual(JSON.parse(data.get("race")), legacy);
    data.set("race-rivals-v1", "broken"); assert.equal(readEventSave("race").best, null);
    data.set("race-long-zones-v1", JSON.stringify({ best: 10.1, loadout: { band: 2 }, barHeight: 3.5 }));
    assert.deepEqual(readEventSave("race"), { best: null, loadout: { band: 2 }, barHeight: 3.5 });
    assert.equal(readEventSave("unknown").best, null);
  } finally { if (old === undefined) delete globalThis.localStorage; else globalThis.localStorage = old; }
});
