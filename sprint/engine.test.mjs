import test from "node:test";
import assert from "node:assert/strict";
import { SprintRace, ZONES, REWARDS, DIP, MODES, getStats, getTimingWindow, scoreZone } from "./engine.mjs";
import { getRunnerPose, METERS_PER_UNIT } from "./runner.mjs";

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function started(gear = {}) { const race = new SprintRace(gear); race.press(); race.release(); return race; }
function until(race, predicate, step = 1 / 240) {
  for (let i = 0; i < 30000 && !predicate(race); i++) race.advance(step);
  assert.ok(predicate(race), "Reached expected state");
}
function to(race, distance, frame = 1 / 120) {
  while (race.distance < distance && !race.terminal) race.advance(Math.min(frame, Math.max(0.00001, (distance - race.distance) / Math.max(1, race.speed))));
}
function playZone(race, index, entry = 0, exit = 0, frame = 1 / 120) {
  const zone = race.zones[index]; to(race, zone.start + entry, frame); race.press();
  to(race, zone.end + exit, frame); race.release(); return zone.result;
}
function completed(gear = {}, entry = 0, exit = 0, frame = 1 / 120) {
  const race = started(gear);
  for (let i = 0; i < 2; i++) playZone(race, i, entry, exit, frame);
  until(race, r => r.terminal, frame); return race;
}

test("one start tap is enough to complete the whole race at baseline speed", () => {
  const race = new SprintRace(); race.advance(5); assert.equal(race.elapsed, 0);
  race.press(); race.release(); race.advance(4);
  assert.equal(race.holding, false); close(race.speed, 8); close(race.elapsed, 4);
  until(race, r => r.terminal);
  assert.equal(race.counts.Miss, 2); assert.equal(race.attempts, 2); assert.equal(race.rhythmScore, 0);
  close(race.distance, 100); assert.equal(race.result.dip, "No dip");
});
test("two long world-space zones leave a recovery section between holds", () => {
  assert.deepEqual(ZONES.map(z => z.start), [15, 60]);
  assert.deepEqual(ZONES.map(z => z.end - z.start), [20, 22]);
  assert.ok(getTimingWindow(ZONES[1], 8).perfectEdge < getTimingWindow(ZONES[0], 8).perfectEdge);
  const race = started(); race.advance(4);
  assert.deepEqual(race.zones.map(z => z.start), ZONES.map(z => z.start));
});
test("weighted score is exactly 30% entry + 30% coverage + 40% release", () => {
  const s = scoreZone(ZONES[0], 14.4, 34.3);
  close(s.score, (s.entry * 0.3 + s.hold * 0.3 + s.release * 0.4) * 100);
  close(s.hold, 19.3 / 20);
  const badEntry = scoreZone(ZONES[0], 16.6, 35);
  const badRelease = scoreZone(ZONES[0], 15, 33.4);
  assert.ok(badEntry.score > badRelease.score, "Release error costs more than equivalent entry error");
});
test("perfect, great, good, early, late, and missed outcomes are distinct", () => {
  for (const [entry, exit, expected] of [[15, 35, "Perfect"], [15.2, 34.8, "Perfect"],
    [16.3, 33.7, "Great"], [16.8, 33.2, "Good"], [15, 31.9, "Early"],
    [15, 38.1, "Late"], [15, 15.2, "Miss"], [11.5, 35, "Miss"]]) {
    assert.equal(scoreZone(ZONES[0], entry, exit).grade, expected, `${entry} / ${exit}`);
  }
});
test("first perfect gives 15% speed and long-hold momentum, only after release", () => {
  const race = started(); to(race, 15); race.press(); to(race, 35);
  assert.equal(race.attempts, 0); assert.equal(race.momentum, 0); close(race.speed, 8);
  race.release(); assert.equal(race.lastAttempt.grade, "Perfect"); close(race.momentum, 2.4);
  close(race.speed, 9.2); close(race.temporaryBoost, 0); close(race.lastAttempt.score, 100, 0.001);
});
test("holding alone does not change speed outside or inside a zone", () => {
  const idle = started(), held = started();
  to(idle, 15); to(held, 15); held.press(); idle.advance(0.4); held.advance(0.4);
  close(held.speed, idle.speed); close(held.distance, idle.distance); assert.equal(held.attempts, 0);
});
test("entry precision matters even with a correct release", () => {
  const race = started(); const result = playZone(race, 0, 3, 0);
  assert.notEqual(result.grade, "Perfect"); assert.ok(result.entry < 0.4);
  close(result.release, 1); assert.ok(result.hold < 0.86);
});
test("each zone resolves once; re-presses cannot farm boosts", () => {
  const race = started(); playZone(race, 0); const speed = race.speed, momentum = race.momentum;
  for (let i = 0; i < 20; i++) { race.press(); race.release(); }
  assert.equal(race.attempts, 1); assert.equal(race.counts.Perfect, 1);
  assert.equal(race.speed, speed); assert.equal(race.momentum, momentum);
});
test("a continuous hold from the start misses all two zones", () => {
  const race = new SprintRace(); race.press(); until(race, r => r.terminal);
  assert.equal(race.counts.Miss, 2); assert.equal(race.counts.Perfect, 0);
  assert.equal(race.momentum, 0); assert.equal(race.peakSpeed, 8);
});
test("a hold past the zone exit fails once and does not start the next zone", () => {
  const race = started(); to(race, 15); race.press(); to(race, 40);
  assert.equal(race.counts.Late, 1); assert.equal(race.counts.Miss, 0);
  assert.equal(race.holding, true); assert.equal(race.activeHold, null);
  race.release(); assert.equal(race.attempts, 1);
  playZone(race, 1); assert.equal(race.counts.Perfect, 1);
});
test("cancellation cannot award a perfect result at the exit", () => {
  const race = started(); to(race, 15); race.press(); to(race, 20); race.cancelInput();
  assert.equal(race.lastAttempt.grade, "Miss"); assert.equal(race.lastAttempt.canceled, true);
  assert.equal(race.lastAttempt.score, 0); assert.equal(race.momentum, 0); close(race.speed, 8);
  race.cancelInput(); race.release(); assert.equal(race.attempts, 1);
});
test("automatic timeout and cancellation keep the reported score components consistent", () => {
  for (const canceled of [false, true]) {
    const race = started(); to(race, 15); race.press(); to(race, canceled ? 34 : 40);
    if (canceled) race.cancelInput();
    const result = race.lastAttempt;
    close(result.score, (result.entry * 0.3 + result.hold * 0.3 + result.release * 0.4) * 100);
  }
});
test("successful zones build momentum that carries between zones and decays gradually", () => {
  const race = started(); playZone(race, 0); const first = race.speed;
  race.advance(0.6); assert.ok(race.momentum > 2.3 && race.momentum < 2.4); assert.ok(race.speed > 8);
  playZone(race, 1); assert.ok(race.speed > first); assert.ok(race.momentum > 1.3);
  const momentum = race.momentum; race.advance(1);
  assert.ok(race.momentum < momentum);
  assert.ok(race.momentum > 0); assert.ok(race.speed >= 8);
});
test("reward percentages and momentum increments match all success tiers", () => {
  for (const [entry, exit, grade] of [[0, 0, "Perfect"], [1.6, -1.6, "Great"], [2.2, -2.2, "Good"], [0, -3.7, "Early"]]) {
    const race = started(); playZone(race, 0, entry, exit);
    assert.equal(race.lastAttempt.grade, grade); close(race.momentum, REWARDS[grade].momentum * 3);
    close(race.speed, 8 * (1 + REWARDS[grade].boost));
  }
});
test("final-zone timing is harder for the same absolute error", () => {
  const normal = scoreZone({ ...ZONES[0], ...getTimingWindow(ZONES[0], 8) }, 16.2, 33.8);
  const final = scoreZone({ ...ZONES[1], ...getTimingWindow(ZONES[1], 8) }, 61.2, 80.8);
  assert.ok(normal.score > final.score); assert.equal(normal.grade, "Perfect");
  assert.equal(final.grade, "Great");
});
test("timing gear widens edge tolerance without moving the track zones", () => {
  const normal = scoreZone(ZONES[0], 16.2, 33.8), geared = scoreZone(ZONES[0], 16.2, 33.8, getStats({ band: 2 }).timingTolerance);
  assert.ok(geared.score > normal.score); assert.equal(geared.grade, "Perfect");
  assert.equal(getStats({ band: -4 }).timingTolerance, 1); assert.equal(getStats({ band: 20 }).timingTolerance, 1.3);
});
test("gear sets the base cap, Flame raises it temporarily, and endurance retains momentum", () => {
  assert.equal(getStats({ band: 2, blocks: 2, kit: 2 }).maxSpeed, getStats().maxSpeed);
  const club = completed(), elite = completed({ spikes: 2 }), endurance = completed({ kit: 2 });
  assert.ok(club.peakSpeed <= 11.2 * (1 + MODES.flameGain));
  assert.ok(elite.peakSpeed > club.peakSpeed && elite.peakSpeed <= 12.4 * (1 + MODES.flameGain));
  assert.ok(endurance.finishTime < club.finishTime); assert.ok(endurance.fatigue < club.fatigue);
  const normal = started(), blocks = started({ blocks: 2 }); normal.advance(1); blocks.advance(1);
  assert.ok(blocks.distance > normal.distance);
});
test("a well-timed two-zone race beats an unattended race", () => {
  const skilled = completed(), unattended = started(); until(unattended, r => r.terminal);
  assert.ok(skilled.finishTime < unattended.finishTime - 1);
  assert.equal(skilled.counts.Perfect, 2); assert.equal(skilled.attempts, 2); assert.equal(skilled.bestCombo, 2);
  assert.ok(skilled.result.rhythmScore > 99.9); assert.equal(skilled.result.zones.length, 2);
});
test("a timed finish dip still crosses the torso collision plane", () => {
  const race = started(); until(race, r => r.phase === "line");
  to(race, 100 - DIP.reach - race.speed * DIP.peak); assert.equal(race.dip(), true);
  assert.equal(race.dip(), false); until(race, r => r.terminal);
  assert.equal(race.result.dip, "Perfect"); close(race.distance + race.result.torsoLead, 100, 0.001);
  const upright = getRunnerPose(0, 0), leaning = getRunnerPose(0, 1);
  close((leaning.shoulder.x - upright.shoulder.x) * METERS_PER_UNIT, DIP.reach);
});
test("30 and 120 FPS give consistent scores and finish times", () => {
  const fast = completed({}, 0, 0, 1 / 120), slow = completed({}, 0, 0, 1 / 30);
  assert.deepEqual(fast.counts, slow.counts); close(fast.finishTime, slow.finishTime, 0.01);
});
test("invalid steps and input after finishing leave the official result unchanged", () => {
  const race = new SprintRace(); for (const value of [NaN, Infinity, -Infinity, 0, -1]) race.advance(value);
  assert.equal(race.time, 0);
  const done = completed(), snapshot = JSON.stringify(done);
  assert.equal(done.press(), false); assert.equal(done.dip(), false); done.advance(10); done.release();
  assert.equal(JSON.stringify(done), snapshot);
});
