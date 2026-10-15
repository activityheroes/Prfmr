import test from "node:test";
import assert from "node:assert/strict";
import { CyclingRace, CYCLING_COURSE } from "./engine.mjs";
import { SprintRace, getStats, scoreZone } from "../sprint/engine.mjs";
import { BIKE, METERS_PER_UNIT, getBikeMotion, getBikePose, drawCyclist, CYCLIST_ART } from "./cyclist.mjs";

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function started(gear = {}) { const r = new CyclingRace(gear); r.press(); r.release(); return r; }
function to(race, distance, frame = 1 / 120) {
  for (let i = 0; i < 30000 && race.distance < distance && !race.terminal; i++) {
    race.advance(Math.min(frame, Math.max(0.00001, (distance - race.distance) / Math.max(race.speed, 1))));
  }
  assert.ok(race.distance >= distance || race.terminal);
}
function play(race, i, entry = 0, exit = 0, frame = 1 / 120) {
  const zone = race.zones[i]; to(race, zone.start + entry, frame); race.press();
  to(race, zone.end + exit, frame); race.release(); return zone.result;
}
function completed(gear = {}, frame = 1 / 120) {
  const race = started(gear); for (let i = 0; i < 6; i++) play(race, i, 0, 0, frame);
  to(race, 200, frame); return race;
}

test("cycling automatically completes 200m at a 12m/s baseline without zone input", () => {
  const race = started(); to(race, 60); close(race.speed, 12);
  assert.equal(race.phase, "sprint"); to(race, 100); assert.equal(race.terminal, false);
  to(race, 200); close(race.distance, 200); assert.equal(race.counts.Miss, 6);
  assert.equal(race.result.dip, null); assert.equal(race.result.torsoLead, 0);
});
test("six cycling zones retain the sprint's timing rules with cycling-sized distances", () => {
  const race = started(); assert.deepEqual(race.zones.map(z => z.start), [30, 60, 90, 120, 150, 180]);
  assert.deepEqual(race.zones.map(z => z.end - z.start), [7.5, 7.5, 7.5, 7.5, 7.5, 4.5]);
  const sprint = new SprintRace();
  for (const [entry, exit] of [[0, 0], [0.4, -0.4], [0.7, -0.7], [0, -1.5], [0, 1]]) {
    const a = scoreZone(sprint.zones[0], 15 + entry, 20 + exit);
    const b = scoreZone(race.zones[0], 30 + entry * 1.5, 37.5 + exit * 1.5);
    assert.equal(a.grade, b.grade); close(a.score, b.score);
  }
});
test("a perfect zone gives 15% speed and momentum that survives the next section", () => {
  const race = started(); play(race, 0);
  assert.equal(race.lastAttempt.grade, "Perfect"); close(race.speed, 13.8); close(race.momentum, 0.8);
  race.advance(1); assert.ok(race.momentum > 0.69); assert.ok(race.speed > 12);
  play(race, 1); assert.ok(race.speed > 13.8); assert.ok(race.momentum > 1.3);
});
test("timing all six zones is faster than riding unattended", () => {
  const perfect = completed(), unattended = started(); to(unattended, 200);
  assert.ok(perfect.finishTime < unattended.finishTime - 1);
  assert.equal(perfect.counts.Perfect, 6); assert.equal(perfect.bestCombo, 6);
  assert.ok(perfect.rhythmScore > 99.9); assert.ok(perfect.peakSpeed <= 16.8);
});
test("continuous holding cannot award or repeat a zone", () => {
  const race = new CyclingRace(); race.press(); to(race, 200);
  assert.equal(race.counts.Miss, 6); assert.equal(race.momentum, 0);
  const over = started(); to(over, 30); over.press(); to(over, 70);
  assert.equal(over.counts.Late, 1); assert.equal(over.counts.Miss, 1);
  over.release(); assert.equal(over.attempts, 2); play(over, 2); assert.equal(over.counts.Perfect, 1);
});
test("early, late and canceled cycling attempts cannot award full boosts", () => {
  const early = started(); play(early, 0, 0, -2.25); assert.equal(early.lastAttempt.grade, "Early");
  close(early.speed, 12 * 1.02);
  const late = started(); play(late, 0, 0, 1.6); assert.equal(late.lastAttempt.grade, "Late");
  const canceled = started(); to(canceled, 30); canceled.press(); to(canceled, 37.5); canceled.cancelInput();
  assert.equal(canceled.lastAttempt.grade, "Miss"); assert.equal(canceled.lastAttempt.score, 0);
  canceled.release(); assert.equal(canceled.attempts, 1);
});
test("cycling equipment and records do not change the sprint model", () => {
  const sprint = new SprintRace(), bike = new CyclingRace({ spikes: 2, blocks: 2 });
  assert.equal(sprint.course.distance, 100); assert.equal(sprint.stats.baseSpeed, 8);
  assert.equal(bike.stats.maxSpeed, 19.2); close(bike.stats.acceleration, 7.2);
  assert.equal(getStats({ kit: 2 }, CYCLING_COURSE).maxSpeed, 16.8);
  const club = completed(), endurance = completed({ kit: 2 }); assert.ok(endurance.finishTime < club.finishTime);
  assert.notEqual(sprint.zones, bike.zones);
});
test("the final straight finishes automatically, with no running dip", () => {
  const race = started(); to(race, 197); assert.equal(race.phase, "line");
  assert.equal(race.press(), false); assert.equal(race.dip(), false); assert.equal(race.dipAmount, 0);
  to(race, 200); const time = race.finishTime; race.advance(10); close(race.finishTime, time);
});
test("physics remains consistent at 30 and 120 FPS", () => {
  const a = completed({}, 1 / 30), b = completed({}, 1 / 120);
  close(a.finishTime, b.finishTime, 0.01); assert.deepEqual(a.counts, b.counts);
});
test("wheel rotation covers the road distance and cadence follows the gear ratio", () => {
  const circumference = BIKE.wheelRadius * METERS_PER_UNIT * Math.PI * 2;
  const motion = getBikeMotion(circumference / 4);
  close(motion.wheelAngle, Math.PI / 2); close(motion.cycle, 0.25 / BIKE.gearRatio);
  close(getBikeMotion(circumference * BIKE.gearRatio).cycle, 0);
  close(CYCLIST_ART.scaleX / CYCLIST_ART.width * CYCLIST_ART.unit, METERS_PER_UNIT);
  close(CYCLIST_ART.scaleY / CYCLIST_ART.height * CYCLIST_ART.unit, METERS_PER_UNIT);
});
test("pedals remain opposed, feet attached and hands fixed throughout each revolution", () => {
  for (let i = 0; i <= 100; i++) {
    const pose = getBikePose(i / 100), [a, b] = pose.limbs;
    close(a.pedal.x + b.pedal.x, BIKE.crank.x * 2); close(a.pedal.y + b.pedal.y, BIKE.crank.y * 2);
    for (const limb of pose.limbs) {
      close(Math.hypot(limb.pedal.x - BIKE.crank.x, limb.pedal.y - BIKE.crank.y), BIKE.crankRadius);
      close(Math.hypot(limb.foot.ankle.x - limb.pedal.x, limb.foot.ankle.y - limb.pedal.y), Math.hypot(0.3, 0.5));
      assert.ok(Math.hypot(limb.hand.x - BIKE.grip.x, limb.hand.y - BIKE.grip.y) < 0.27);
      assert.ok(Number.isFinite(limb.knee.x) && Number.isFinite(limb.elbow.y));
    }
  }
});
test("all dot artwork fits inside the texture across the complete pedal cycle", () => {
  const art = CYCLIST_ART;
  const ctx = { save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, fill() {},
    arc(x, y, r) {
      assert.ok(art.x + (x - r) * art.unit >= 0 && art.x + (x + r) * art.unit <= art.width);
      assert.ok(art.ground + (y - r) * art.unit >= 0 && art.ground + (y + r) * art.unit <= art.height);
    }
  };
  for (let i = 0; i < 40; i++) drawCyclist(ctx, art.x, art.ground, art.unit, { distance: i * 0.3 });
});
