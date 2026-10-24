import test from "node:test";
import assert from "node:assert/strict";
import { CyclingRace, CYCLING_COURSE } from "./engine.mjs";
import { SprintRace, getStats, scoreZone, MODES } from "../sprint/engine.mjs";
import { BIKE, METERS_PER_UNIT, getBikeMotion, getBikePose, drawCyclist, CYCLIST_ART } from "./cyclist.mjs";
import { VELODROME, ovalPoint, bankAngle, trackPoint, bikeFrame } from "./velodrome.mjs";
import { DotBike } from "./dot-bike.mjs";

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
  const race = started(gear); for (let i = 0; i < 2; i++) play(race, i, 0, 0, frame);
  race.activateFlame(); to(race, 200, frame); return race;
}

test("cycling starts rolling and automatically completes 200m at a 15m/s baseline", () => {
  const race = started(); close(race.speed, 10); to(race, 60); close(race.speed, 15);
  assert.equal(race.phase, "sprint"); to(race, 100); assert.equal(race.terminal, false);
  to(race, 200); close(race.distance, 200); assert.equal(race.counts.Miss, 2);
  assert.equal(race.result.dip, null); assert.equal(race.result.torsoLead, 0);
});
test("two cycling zones retain the sprint's timing rules with cycling-sized distances", () => {
  const race = started(); assert.deepEqual(race.zones.map(z => z.start), [30, 120]);
  assert.deepEqual(race.zones.map(z => z.end - z.start), [32, 35]);
  for (const zone of race.zones) {
    const score = scoreZone(zone, zone.start, zone.end);
    assert.equal(score.grade, "Perfect"); close(score.score, 100);
    assert.ok((zone.end - zone.start) / race.stats.maxSpeed >= 0.33, "A visible hold window remains at top speed");
  }
});
test("a perfect zone gives 15% speed and momentum that survives the next section", () => {
  const race = started(); play(race, 0);
  assert.equal(race.lastAttempt.grade, "Perfect"); close(race.speed, 17.25); close(race.momentum, 2.4);
  race.advance(1); assert.ok(race.momentum > 0.69); assert.ok(race.speed > 17);
  play(race, 1); assert.ok(race.speed > 17.25); assert.ok(race.momentum > 1.3);
});
test("timing all two zones is faster than riding unattended", () => {
  const perfect = completed(), unattended = started(); to(unattended, 200);
  assert.ok(perfect.finishTime < unattended.finishTime - 1);
  assert.equal(perfect.counts.Perfect, 2); assert.equal(perfect.bestCombo, 2);
  assert.ok(perfect.rhythmScore > 99.9); assert.ok(perfect.peakSpeed <= perfect.stats.maxSpeed * (1 + MODES.flameGain));
  assert.equal(perfect.flameCount, 1); assert.ok(unattended.finishTime < 14);
});
test("continuous holding cannot award or repeat a zone", () => {
  const race = new CyclingRace(); race.press(); to(race, 200);
  assert.equal(race.counts.Miss, 2); assert.equal(race.momentum, 0);
  const over = started(); to(over, 30); over.press(); to(over, 80);
  assert.equal(over.counts.Late, 1); assert.equal(over.counts.Miss, 0);
  over.release(); assert.equal(over.attempts, 1); play(over, 1); assert.equal(over.counts.Perfect, 1);
});
test("early, late and canceled cycling attempts cannot award full boosts", () => {
  const early = started(); play(early, 0, 0, -6.5); assert.equal(early.lastAttempt.grade, "Early");
  close(early.speed, 15 * 1.02);
  const late = started(); play(late, 0, 0, 7); assert.equal(late.lastAttempt.grade, "Late");
  const canceled = started(); to(canceled, 30); canceled.press(); to(canceled, 40); canceled.cancelInput();
  assert.equal(canceled.lastAttempt.grade, "Miss"); assert.equal(canceled.lastAttempt.score, 0);
  canceled.release(); assert.equal(canceled.attempts, 1);
});
test("cycling equipment and records do not change the sprint model", () => {
  const sprint = new SprintRace(), bike = new CyclingRace({ spikes: 2, blocks: 2 });
  assert.equal(sprint.course.distance, 100); assert.equal(sprint.stats.baseSpeed, 8);
  assert.equal(bike.stats.maxSpeed, 24); close(bike.stats.acceleration, 10.8);
  assert.equal(getStats({ kit: 2 }, CYCLING_COURSE).maxSpeed, 21);
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

test("the closed 250m velodrome has continuous position and tangent through both bends", () => {
  for (let s = -20; s <= 270; s += 0.25) {
    const a = ovalPoint(s), b = ovalPoint(s + 250), next = ovalPoint(s + 0.001);
    close(a.x, b.x, 1e-10); close(a.z, b.z, 1e-10);
    close(Math.cos(a.heading), Math.cos(b.heading)); close(Math.sin(a.heading), Math.sin(b.heading));
    close(Math.hypot(next.x - a.x, next.z - a.z), 0.001, 1e-8);
    assert.ok(Math.cos(next.heading - a.heading) > 0.999999);
  }
  close(2 * VELODROME.straight + 2 * Math.PI * VELODROME.radius, VELODROME.length);
});
test("banking transitions smoothly between the straights and steeper bends", () => {
  close(bankAngle(0), VELODROME.bendBank * Math.PI / 180);
  close(bankAngle(200), VELODROME.straightBank * Math.PI / 180);
  for (let s = -20; s <= 270; s += 0.1) {
    const angle = bankAngle(s), inner = trackPoint(s, VELODROME.inner), outer = trackPoint(s, VELODROME.outer);
    assert.ok(angle >= 12 * Math.PI / 180 && angle <= 42 * Math.PI / 180);
    close(angle, bankAngle(s + 250)); assert.ok(Math.abs(bankAngle(s + 0.001) - angle) < 0.0001);
    close(inner.y, 0); close(trackPoint(s, VELODROME.apron).y, 0); assert.ok(outer.y > inner.y);
  }
});
test("both tires stay on the banked track and the rider frame stays orthonormal", () => {
  const frontOffset = BIKE.wheelRadius * METERS_PER_UNIT, wheelbase = (BIKE.front.x - BIKE.rear.x) * METERS_PER_UNIT;
  for (let s = 0; s <= 210; s += 0.1) {
    const f = bikeFrame(s);
    for (const axis of [f.forward, f.up, f.side]) close(axis.length(), 1);
    close(f.forward.dot(f.up), 0); close(f.up.dot(f.side), 0); close(f.side.dot(f.forward), 0);
    assert.ok(f.stretch > 0.995 && f.stretch < 1.005);
    for (const [offset, contact] of [[frontOffset, f.front], [frontOffset + wheelbase, f.rear]]) {
      const tire = f.origin.clone().addScaledVector(f.forward, -offset * f.stretch).addScaledVector(f.up, -0.04);
      close(tire.distanceTo(contact), 0); assert.ok([tire.x, tire.y, tire.z].every(Number.isFinite));
    }
  }
});
test("the 200m timing line is on the home straight and the boost distances stay unchanged", () => {
  close(ovalPoint(200).heading, 0); close(ovalPoint(197).heading, 0);
  assert.deepEqual(CYCLING_COURSE.zones.map(z => z.start), [30, 120]);
  const r = completed(); close(r.distance, 200); assert.equal(r.counts.Perfect, 2);
});

test("overview rider scales keep both wheels planted through the entire lap", () => {
  for (const scale of [1.8, 2.8]) for (let s = 0; s <= 250; s += 0.5) {
    const f = bikeFrame(s, scale), frontOffset = BIKE.wheelRadius * METERS_PER_UNIT * scale;
    const wheelbase = (BIKE.front.x - BIKE.rear.x) * METERS_PER_UNIT * scale;
    for (const [offset, contact] of [[frontOffset, f.front], [frontOffset + wheelbase, f.rear]]) {
      const tire = f.origin.clone().addScaledVector(f.forward, -offset * f.stretch).addScaledVector(f.up, -0.04);
      close(tire.distanceTo(contact), 0);
    }
  }
});

test("the volumetric dot cyclist has finite animated joints and fits one instanced draw", () => {
  const bike = new DotBike(); let previous;
  for (let s = 0; s < 20; s += 0.2) {
    bike.update({ distance: s });
    assert.ok(bike.count > 300 && bike.count < bike.instanceMatrix.count);
    const data = bike.instanceMatrix.array.slice(0, bike.count * 16);
    assert.ok(data.every(Number.isFinite));
    const depths = Array.from({ length: bike.count }, (_, i) => data[i * 16 + 14]);
    assert.ok(Math.max(...depths) > 0.1 && Math.min(...depths) < -0.1);
    if (previous) assert.notDeepEqual(data, previous);
    previous = data;
  }
  bike.geometry.dispose(); bike.material.dispose(); bike.dispose();
});
