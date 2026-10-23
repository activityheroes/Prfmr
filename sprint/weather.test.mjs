import test from "node:test";
import assert from "node:assert/strict";
import { WEATHER, createWeather, weatherAt, isWinter, isIndoor } from "./weather.mjs";
import { SprintRace, SPRINT_COURSE, scoreZone, releaseBands } from "./engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { HurdlesRace } from "../hurdles/engine.mjs";
import { SpeedSkatingRace } from "../speed-skating/engine.mjs";
import { BiathlonRace } from "../biathlon/engine.mjs";
import { JavelinRace } from "../javelin/engine.mjs";
import { PoleVaultRace } from "../pole-vault/engine.mjs";
import { LongJumpRace } from "../long-jump/engine.mjs";
import { HighJumpRace } from "../high-jump/engine.mjs";
import { SkiJumpRace } from "../ski-jumping/engine.mjs";

const races = [SprintRace, CyclingRace, SwimmingRace, HurdlesRace, SpeedSkatingRace, BiathlonRace,
  JavelinRace, PoleVaultRace, LongJumpRace, HighJumpRace, SkiJumpRace];
const close = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
function until(r, condition, dt = 1 / 120) {
  for (let i = 0; i < 30000 && !condition(); i++) r.advance(dt);
  assert.ok(condition(), "Expected state is reachable");
}
function shoot(r, dt) {
  while (r.phase === "shooting") {
    if (r.canAim && !r.holding) r.press();
    if (r.holding && r.heldFor >= 0.3 && r.aim.error < 0.15) r.release();
    r.advance(dt);
  }
}
function to(r, d, dt = 1 / 120) {
  for (let i = 0; i < 30000 && r.distance < d && !r.terminal; i++) {
    if (r.phase === "shooting") shoot(r, dt);
    else r.advance(Math.min(dt, Math.max(1e-6, (d - r.distance) / Math.max(1, r.speed))));
  }
  assert.ok(r.distance >= d || r.terminal);
}
function complete(Race, kind = "random", dt = 1 / 120, seed = 973129) {
  const r = new Race().setWeather(seed, kind); r.press(); r.release();
  for (const z of r.zones) {
    to(r, z.start, dt); r.press(); to(r, z.end, dt);
    const frozen = { ...r.timingWindow(z) }, bands = releaseBands({ ...z, ...frozen }, z.attempt.distance);
    assert.ok(r.distance >= bands.perfect.start && r.distance <= bands.perfect.end);
    r.release(); assert.equal(z.result.grade, "Perfect");
  }
  if (r.finishZone) { to(r, r.finishZone.start, dt); r.press(); to(r, r.finishZone.end, dt); r.release(); }
  until(r, () => r.terminal, dt); return r;
}

test("seeded forecasts are repeatable, varied, bounded and appropriate to the venue", () => {
  const found = new Set();
  for (const Race of races) for (let i = 0; i < 60; i++) {
    const r = new Race(), seed = Math.imul(i, 2654435761) >>> 0;
    const a = createWeather(r.course, seed, "random");
    assert.deepEqual(a, createWeather(r.course, seed, "random")); found.add(a.base);
    if (isIndoor(r.course.id)) { assert.equal(a.base, "indoor"); assert.equal(a.front, null); }
    else if (isWinter(r.course.id)) assert.ok(![a.base, a.front].some(k => ["rain", "storm"].includes(k)));
    else assert.ok(![a.base, a.front].some(k => ["snow", "blizzard"].includes(k)));
    for (let t = 0; t < 60; t += 0.2) {
      const c = weatherAt(a, t); assert.ok(WEATHER[c.key]);
      assert.ok(c.pace >= 0.88 && c.pace <= 1.06); assert.ok(c.grip >= 0.8 && c.grip <= 1);
      assert.ok(Math.abs(c.pace - weatherAt(a, t + 0.01).pace) < 0.003);
      if (a.indoor) { close(c.pace, 1); close(c.wind, 0); }
    }
  }
  assert.deepEqual([...found].sort(), Object.keys(WEATHER).sort());
});
test("a changing front warns first, ramps smoothly, and passes without flashing", () => {
  const w = createWeather(SPRINT_COURSE, 42, "random");
  assert.equal(weatherAt(w, w.frontAt - 1).upcoming, w.front);
  close(weatherAt(w, w.frontAt).rain, WEATHER[w.base].rain);
  assert.equal(weatherAt(w, w.frontAt + 2).key, w.front);
  assert.equal(weatherAt(w, w.frontAt + w.duration + 2).key, w.base);
});
test("headwinds, tailwinds and rain change real running speed and finish time", () => {
  const runs = Object.fromEntries(["clear", "headwind", "tailwind", "rain", "storm"].map(kind => {
    const r = new SprintRace().setWeather(42, kind); r.press(); r.release(); until(r, () => r.terminal); return [kind, r];
  }));
  assert.ok(runs.tailwind.finishTime < runs.clear.finishTime - 0.3);
  assert.ok(runs.headwind.finishTime > runs.clear.finishTime + 0.3);
  assert.ok(runs.storm.finishTime > runs.rain.finishTime);
  assert.ok(runs.storm.finishTime < runs.clear.finishTime * 1.2);
});
test("weather cannot be rerolled mid-race or alter the timing frozen on press", () => {
  const r = new SprintRace().setWeather(42); r.press(); r.release();
  const weather = r.weather; r.setWeather(11, "tailwind"); assert.equal(r.weather, weather);
  to(r, r.nextZone.start); r.press(); const timing = { ...r.activeHold.attempt.timing }, z = r.activeHold;
  to(r, z.end); assert.deepEqual(r.timingWindow(z), timing);
  assert.equal(scoreZone({ ...z, ...timing }, z.attempt.distance, r.distance).grade, "Perfect");
});
test("indoor venues preserve calm physics regardless of the random seed", () => {
  for (const Race of [CyclingRace, SwimmingRace]) {
    const calm = complete(Race, "clear"), random = complete(Race);
    close(calm.finishTime, random.finishTime); assert.equal(random.conditions.indoor, true);
  }
});
for (const Race of races) test(`${Race.name}: perfect holds remain playable in adverse weather and at both frame rates`, () => {
  const kind = isWinter(new Race().course.id) ? "blizzard" : "storm";
  const a = complete(Race, kind), b = complete(Race, kind, 1 / 30);
  assert.equal(a.counts.Perfect, a.zones.length); assert.equal(b.counts.Perfect, b.zones.length);
  assert.ok(a.flameCount > 0); assert.ok(a.peakSpeed <= a.stats.maxSpeed * 1.2 + 1e-5);
  close(a.finishTime, b.finishTime, Race === BiathlonRace ? 0.3 : 0.04);
  if (a.result.mark !== undefined) assert.ok(a.result.mark > 0, JSON.stringify(a.result));
  if (typeof a.result.cleared === "boolean") assert.equal(a.result.cleared, true);
  if (Race === HurdlesRace) assert.equal(a.hits, 0);
  const snapshot = JSON.stringify(a.result); a.advance(10); a.setWeather();
  assert.equal(JSON.stringify(a.result), snapshot); assert.ok(a.result.weather.summary);
});
test("wind changes javelin and long-jump flight without adding random fouls", () => {
  for (const Race of [JavelinRace, LongJumpRace]) {
    const head = complete(Race, "headwind"), tail = complete(Race, "tailwind");
    assert.ok(tail.result.mark > head.result.mark); assert.equal(head.result.foul, false); assert.equal(tail.result.foul, false);
  }
});
test("random fronts remain deterministic at 30 and 120 FPS across every event", () => {
  for (const Race of races) {
    const a = complete(Race), b = complete(Race, "random", 1 / 30);
    assert.deepEqual(a.counts, b.counts); close(a.finishTime, b.finishTime, Race === BiathlonRace ? 0.3 : 0.04);
    assert.equal(a.result.weather.summary, b.result.weather.summary);
    if (a.result.mark != null) close(a.result.mark, b.result.mark, 0.06);
  }
});
test("Biathlon wind drift agrees with the visible aim and leaves time to hit", () => {
  const r = new BiathlonRace().setWeather(42, "blizzard"); r.press(); r.release();
  until(r, () => r.phase === "shooting");
  for (let i = 0; i < 20; i++) {
    r.advance(0.1); const aim = r.aim;
    close(aim.error, Math.hypot(aim.x, aim.y)); assert.equal(aim.centered, aim.error <= aim.radius);
  }
  shoot(r, 1 / 120); assert.equal(r.hits, 5);
});
