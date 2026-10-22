import test from "node:test";
import assert from "node:assert/strict";
import { SprintRace, getTimingWindow, scoreZone } from "./engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { JavelinRace, THROW_ZONE } from "../javelin/engine.mjs";
import { PoleVaultRace, PLANT_ZONE } from "../pole-vault/engine.mjs";
import { LongJumpRace, TAKEOFF_ZONE } from "../long-jump/engine.mjs";
import { HighJumpRace, TAKEOFF_ZONE as HIGH_TAKEOFF_ZONE } from "../high-jump/engine.mjs";
import { HurdlesRace } from "../hurdles/engine.mjs";
import { SpeedSkatingRace } from "../speed-skating/engine.mjs";
import { SkiJumpRace } from "../ski-jumping/engine.mjs";

const races = [SprintRace, CyclingRace, SwimmingRace, JavelinRace, PoleVaultRace, LongJumpRace, HighJumpRace, HurdlesRace, SpeedSkatingRace, SkiJumpRace];
const successCount = r => r.counts.Perfect + r.counts.Great + r.counts.Good;
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function react(Race, delay, gear = {}, finish = false) {
  const r = new Race(gear); r.press(); r.release();
  let pressAt = null, releaseAt = null;
  for (let i = 0; i < 20000 && (r.phase === "sprint" || finish && r.phase === "line"); i++) {
    if (r.cue === "press" && !r.holding && pressAt === null) pressAt = r.time + delay;
    if (pressAt !== null && r.time >= pressAt) { r.press(); pressAt = null; }
    if (r.cue === "release" && r.holding && releaseAt === null) releaseAt = r.time + delay;
    if (releaseAt !== null && r.time >= releaseAt) { r.release(); releaseAt = null; }
    r.advance(1 / 240);
  }
  return r;
}

for (const Race of races) {
  const name = new Race().course.id;
  test(`${name}: ordinary cue reaction is rewarded, exact timing still wins`, () => {
    const precise = react(Race, 0.12), player = react(Race, 0.18), delayed = react(Race, 0.24);
    assert.equal(precise.counts.Perfect, precise.zones.length);
    assert.equal(successCount(player), player.zones.length);
    assert.ok(player.counts.Perfect < player.zones.length);
    assert.ok(precise.rhythmScore > player.rhythmScore);
    assert.ok(player.rhythmScore > delayed.rhythmScore + 15);
    assert.ok(delayed.counts.Late + delayed.counts.Miss > 0);
  });
  test(`${name}: faster gear keeps readable windows without moving targets`, () => {
    const r = react(Race, 0.18, { spikes: 2, blocks: 2, kit: 2 });
    assert.equal(successCount(r), r.zones.length);
    assert.deepEqual(r.zones.map(z => [z.start, z.end]), r.course.zones.map(z => [z.start, z.end]));
    const first = getTimingWindow(r.zones[0], r.stats.maxSpeed), last = getTimingWindow(r.zones.at(-1), r.stats.maxSpeed);
    close(first.edgeWindow / r.stats.maxSpeed, 0.24);
    close(last.edgeWindow / r.stats.maxSpeed, 0.18);
    assert.ok(first.perfectEdge > last.perfectEdge);
  });
}

test("a whole-zone hold is not penalized twice for a slightly late release", () => {
  const r = new SprintRace(), zone = { ...r.zones[0], ...r.timingWindow(r.zones[0]) };
  const result = scoreZone(zone, zone.start, zone.end + 0.8);
  close(result.hold, 1); assert.equal(result.grade, "Great");
  close(result.score, 100 * (0.3 * result.entry + 0.3 * result.hold + 0.4 * result.release));
  assert.equal(scoreZone(zone, zone.start, zone.end + 2).grade, "Late");
  assert.equal(scoreZone(zone, zone.start, zone.start + 0.1).grade, "Miss");
});
test("cue lead and prep time scale with speed, and scoring freezes on press", () => {
  const r = new SprintRace(); r.press(); r.release(); r.speed = 10;
  r.distance = 9; assert.equal(r.cue, "prepare");
  r.distance = 13.8; assert.equal(r.cue, "press");
  const timing = r.timingWindow(r.nextZone); r.press();
  assert.deepEqual(r.activeHold.attempt.timing, timing);
  r.speed = 11.2; assert.deepEqual(r.timingWindow(r.activeHold), timing);
  r.distance = 18; assert.equal(r.cue, "hold");
  r.distance = 19; assert.equal(r.cue, "release");
  r.cancelInput(); assert.equal(r.lastAttempt.grade, "Miss"); assert.equal(r.lastAttempt.score, 0);
});
test("equipment scales the same timing bands used for scoring", () => {
  const plain = new SprintRace(), geared = new SprintRace({ band: 2 });
  const a = plain.timingWindow(plain.nextZone), b = geared.timingWindow(geared.nextZone);
  close(b.edgeWindow / a.edgeWindow, 1.3); close(b.perfectEdge / a.perfectEdge, 1.3);
});
test("field-event gold zones use the same cues, and long jump still respects the board", () => {
  for (const [Race, zone, key] of [[JavelinRace, THROW_ZONE, "launch"], [PoleVaultRace, PLANT_ZONE, "plant"], [LongJumpRace, TAKEOFF_ZONE, "launch"], [HighJumpRace, HIGH_TAKEOFF_ZONE, "launch"]]) {
    const r = react(Race, 0.2, {}, true);
    assert.ok(r[key], r.course.id + " should execute its final action");
    assert.ok(r[key].timing.score >= 65);
    if (r.course.id === "long-jump") assert.ok(r.distance < 45);
    const idle = new Race(); idle.press(); idle.release(); idle.phase = "line"; idle.distance = zone.start - 0.3; idle.speed = 8;
    assert.equal(idle.cue, "press");
  }
});
