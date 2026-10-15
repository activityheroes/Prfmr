import test from "node:test";
import assert from "node:assert/strict";
import { SwimmingRace, SWIMMING_COURSE } from "./engine.mjs";
import { SprintRace, scoreZone } from "../sprint/engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SWIM, SWIMMER_ART, getSwimCycle, getSwimPose, drawSwimmer } from "./swimmer.mjs";

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function started(gear = {}) { const race = new SwimmingRace(gear); race.press(); race.release(); return race; }
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
  to(race, 50, frame); return race;
}
test("automatic swimming completes 50m without repeated input", () => {
  const race = started(); to(race, 7); close(race.speed, 1.9);
  to(race, 50); close(race.distance, 50); assert.equal(race.counts.Miss, 6);
  assert.ok(race.finishTime > 26 && race.finishTime < 29);
  assert.equal(race.result.dip, null); assert.equal(race.result.torsoLead, 0);
});
test("six fixed swim zones use the same weighted timing, with a narrower final zone", () => {
  const swim = new SwimmingRace(), run = new SprintRace();
  assert.deepEqual(swim.zones.map(z => z.start), [7.5, 15, 22.5, 30, 37.5, 45]);
  assert.deepEqual(swim.zones.map(z => z.end - z.start), [1.25, 1.25, 1.25, 1.25, 1.25, 0.75]);
  for (const [entry, exit] of [[0, 0], [0.4, -0.4], [0.7, -0.7], [0, -1.5], [0, 1]]) {
    const a = scoreZone(run.zones[0], 15 + entry, 20 + exit);
    const b = scoreZone(swim.zones[0], 7.5 + entry / 4, 8.75 + exit / 4);
    assert.equal(a.grade, b.grade); close(a.score, b.score);
    close(b.score, 100 * (b.entry * 0.3 + b.hold * 0.3 + b.release * 0.4));
  }
});
test("perfect swimming gives 15% speed and scaled momentum that carries forward", () => {
  const race = started(); play(race, 0);
  assert.equal(race.lastAttempt.grade, "Perfect"); close(race.speed, 1.9 * 1.15); close(race.momentum, 0.19);
  race.advance(1); assert.ok(race.momentum > 0.16); assert.ok(race.speed > 1.9);
  play(race, 1); assert.ok(race.momentum > 0.27); assert.ok(race.speed > 2.185);
});
test("six successful zones beat baseline and remain under the swimming speed cap", () => {
  const race = completed(), baseline = started(); to(baseline, 50);
  assert.equal(race.counts.Perfect, 6); assert.equal(race.bestCombo, 6);
  assert.ok(race.rhythmScore > 99.9); assert.ok(race.peakSpeed <= 2.65);
  assert.ok(race.finishTime < baseline.finishTime - 2);
});
test("holding from the start and holding past the exit cannot farm boosts", () => {
  const race = new SwimmingRace(); race.press(); to(race, 50); assert.equal(race.counts.Miss, 6);
  const over = started(); to(over, 7.5); over.press(); to(over, 17);
  assert.equal(over.counts.Late, 1); assert.equal(over.counts.Miss, 1);
  over.release(); assert.equal(over.attempts, 2); play(over, 2); assert.equal(over.counts.Perfect, 1);
});
test("early, late and canceled swim attempts never award a perfect boost", () => {
  const early = started(); play(early, 0, 0, -0.375); assert.equal(early.lastAttempt.grade, "Early"); close(early.lastAttempt.boost, 0.02);
  const late = started(); play(late, 0, 0, 0.27); assert.equal(late.lastAttempt.grade, "Late");
  const canceled = started(); to(canceled, 7.5); canceled.press(); to(canceled, 8.75); canceled.cancelInput(); canceled.release();
  assert.equal(canceled.lastAttempt.grade, "Miss"); assert.equal(canceled.lastAttempt.score, 0); assert.equal(canceled.attempts, 1);
});
test("swim gear scales timing, acceleration, cap and endurance independently of other sports", () => {
  const club = started(), elite = started({ band: 2, blocks: 2, spikes: 2, kit: 2 });
  close(elite.stats.timingTolerance, 1.3); close(elite.stats.acceleration, 2.76);
  close(elite.stats.maxSpeed, 2.95); close(elite.stats.endurance, 1.8);
  assert.deepEqual(club.zones, elite.zones);
  assert.ok(completed({ kit: 2 }).finishTime < completed().finishTime);
  assert.equal(new SprintRace().stats.baseSpeed, 8); assert.equal(new CyclingRace().stats.baseSpeed, 12);
});
test("the wall finish is automatic, frozen and frame-rate independent", () => {
  const a = completed({}, 1 / 30), b = completed({}, 1 / 120); close(a.finishTime, b.finishTime, 0.01);
  assert.deepEqual(a.counts, b.counts);
  const race = started(); to(race, SWIMMING_COURSE.finishAt);
  assert.equal(race.phase, "line"); assert.equal(race.press(), false); assert.equal(race.dip(), false);
  to(race, 50); const time = race.finishTime; race.advance(10); close(race.finishTime, time);
});
test("stroke cadence follows distance and arm phases stay half a cycle apart", () => {
  close(getSwimCycle(SWIM.metersPerStroke), 0); close(getSwimCycle(SWIM.metersPerStroke / 4), 0.25);
  for (let i = 0; i < 100; i++) {
    const p = getSwimPose(i / 100), [a, b] = p.arms;
    close(Math.abs(a.phase - b.phase), 0.5);
    for (const arm of p.arms) {
      close(Math.hypot(arm.elbow.x - p.shoulder.x, arm.elbow.y - p.shoulder.y), 2.35);
      close(Math.hypot(arm.hand.x - arm.elbow.x, arm.hand.y - arm.elbow.y), 2.2);
    }
    for (const leg of p.legs) {
      close(Math.hypot(leg.knee.x - p.hip.x, leg.knee.y - p.hip.y), 4.25);
      close(Math.hypot(leg.ankle.x - leg.knee.x, leg.ankle.y - leg.knee.y), 4.1);
    }
  }
  const first = getSwimPose(0), last = getSwimPose(1 - 1e-8);
  close(first.arms[0].hand.x, last.arms[0].hand.x, 1e-5);
  close(first.arms[0].hand.y, last.arms[0].hand.y, 1e-5);
  close(getSwimPose(0.4, 1).arms[0].hand.x, SWIM.reach);
});
test("the complete stroke and final reach stay inside the dot texture", () => {
  let matrix = [1, 0, 0, 1, 0, 0], stack = [], dots = 0;
  const multiply = m => { const [a,b,c,d,e,f] = matrix, [g,h,i,j,k,l] = m; matrix = [a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f]; };
  const art = SWIMMER_ART;
  const ctx = { save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); },
    translate(x,y) { multiply([1,0,0,1,x,y]); }, scale(x,y) { multiply([x,0,0,y,0,0]); },
    rotate(t) { multiply([Math.cos(t),Math.sin(t),-Math.sin(t),Math.cos(t),0,0]); },
    beginPath() {}, fill() {}, fillRect() {},
    arc(x,y,r) {
      const [a,b,c,d,e,f] = matrix, px = a*x+c*y+e, py = b*x+d*y+f, radius = Math.hypot(a,b)*r;
      assert.ok(px-radius>=0 && px+radius<=art.width && py-radius>=0 && py+radius<=art.height, JSON.stringify({px,py,radius})); dots++;
    }
  };
  for (let i = 0; i <= 100; i++) drawSwimmer(ctx, art.x, art.ground, art.unit, { distance: i / 100 * SWIM.metersPerStroke });
  for (let i = 0; i <= 20; i++) drawSwimmer(ctx, art.x, art.ground, art.unit, { distance: 49 + i / 20 });
  assert.ok(dots > 10000);
});
