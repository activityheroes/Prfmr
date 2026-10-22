import test from "node:test";
import assert from "node:assert/strict";
import { MODES } from "../sprint/engine.mjs";
import { BiathlonRace, BIATHLON_COURSE, RANGE } from "./engine.mjs";
import { HILLS, trailHeight, trailGrade, terrainFactor, aimAt } from "./course.mjs";
import { STRIDE, SKIER_SCALE, getSkierPose, skierDots } from "./skier.mjs";
import { beginFinish, advanceFinish, finishTravel } from "../sprint/finish.mjs";
const close = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
function started(gear = {}) { const r = new BiathlonRace(gear); r.press(); r.release(); return r; }
function until(r, condition, dt = 1 / 120) { for (let i = 0; i < 30000 && !condition(); i++) r.advance(dt); assert.ok(condition(), "condition must be reachable"); }
function to(r, distance, dt = 1 / 120) { until(r, () => r.distance >= distance || r.terminal, dt); }
function range(r = started(), dt) { until(r, () => r.phase === "shooting", dt); until(r, () => r.canAim, dt); return r; }
function shoot(r, hit = true, dt = 1 / 120) {
  until(r, () => r.canAim, dt); assert.equal(r.press(), true);
  until(r, () => r.heldFor >= RANGE.minimumHold && (hit ? r.aim.error < 0.12 : r.aim.error > 0.52), dt);
  r.release();
}
function complete({ good = false, hits = 5, dt = 1 / 120, gear = {} } = {}) {
  const r = started(gear);
  while (!r.terminal) {
    if (r.phase === "shooting") {
      if (r.shots.length < 5) shoot(r, r.shots.length < hits, dt);
      else until(r, () => r.phase !== "shooting", dt);
      continue;
    }
    const z = r.nextZone;
    if (good && z && r.distance >= z.start && !r.holding) r.press();
    if (r.activeHold && r.distance >= r.activeHold.end) r.release();
    r.advance(dt);
  }
  return r;
}

test("four smooth hills leave a level shooting range and finish", () => {
  for (const hill of HILLS) {
    close(trailHeight(hill.start), 0); close(trailHeight(hill.end), 0);
    close(trailHeight((hill.start + hill.end) / 2), hill.height);
    close(trailGrade(hill.start), 0, 1e-5); close(trailGrade(hill.end), 0, 1e-5);
  }
  for (let d = 190; d < 210; d++) { close(trailHeight(d), 0); close(terrainFactor(d), 1); }
  close(trailHeight(400), 0); assert.ok(terrainFactor(30) < 1); assert.ok(terrainFactor(60) > 1);
});
test("baseline skiing is automatic and stops precisely at the range", () => {
  const r = range(); close(r.distance, RANGE.distance); close(r.speed, 0); assert.ok(r.racing); assert.equal(r.attempts, 3);
  const elapsed = r.elapsed; r.advance(3); close(r.distance, 200); close(r.elapsed - elapsed, 3);
  assert.equal(r.shots.length, 0); assert.equal(r.phase, "shooting");
});
test("entering the range cancels an old ski hold and waits for a fresh press", () => {
  const r = started(); r.press(); until(r, () => r.phase === "shooting");
  assert.equal(r.holding, false); assert.equal(r.activeHold, null); assert.equal(r.press(), false); r.release();
  assert.equal(r.shots.length, 0); assert.equal(r.events.filter(e => e.type === "range-enter").length, 1);
});
test("a centered release hits one target, repeated releases cannot shoot", () => {
  const r = range(); shoot(r); assert.equal(r.hits, 1); close(r.penalty, 0); assert.equal(r.lastShot.perfect, true);
  r.release(); assert.equal(r.shots.length, 1); assert.equal(r.press(), false);
});
test("short taps and canceled holds use no ammunition and add no penalties", () => {
  const r = range(); r.press(); r.advance(0.1); r.release(); assert.equal(r.shots.length, 0);
  r.press(); r.advance(0.5); r.cancelInput(); r.release(); close(r.penalty, 0); assert.equal(r.shots.length, 0); assert.equal(r.holding, false);
});
test("misses add two seconds once and never disqualify the skier", () => {
  const r = range(); shoot(r, false); close(r.penalty, 2); close(r.elapsed, r.time - r.startAt + 2);
  r.release(); close(r.penalty, 2); assert.equal(r.hits, 0); assert.equal(r.terminal, false);
});
test("five shots trigger a readable departure pause and skiing resumes", () => {
  const r = range(); for (let i = 0; i < 5; i++) shoot(r);
  assert.equal(r.phase, "shooting"); assert.equal(r.press(), false); r.advance(0.5); close(r.distance, 200);
  r.advance(1); assert.equal(r.phase, "sprint"); assert.ok(r.distance > 200); assert.equal(r.hits, 5);
  assert.equal(r.events.filter(e => e.type === "range-exit").length, 1);
});
test("holding forever does not auto-fire or farm hits", () => {
  const r = range(); r.press(); r.advance(15); assert.equal(r.shots.length, 0); close(r.distance, 200);
  r.release(); assert.equal(r.shots.length, 1);
});
test("six perfect boost zones build momentum and improve the total", () => {
  const a = complete(), b = complete({ good: true });
  assert.equal(b.counts.Perfect, 6); assert.equal(b.hits, 5); assert.ok(b.result.time < a.result.time); assert.equal(b.bestCombo, 6);
  assert.ok(b.peakSpeed > BIATHLON_COURSE.baseSpeed); assert.ok(b.peakSpeed <= b.stats.maxSpeed * (1 + MODES.flameGain) + 1e-5);
});
test("all misses still finish, with total time and result penalties agreeing", () => {
  const r = complete({ hits: 0 }); close(r.distance, 400); close(r.result.penalty, 10); close(r.result.time, r.result.courseTime + 10);
  close(r.elapsed, r.result.time); assert.equal(r.result.shots.length, 5); assert.equal(r.result.hits, 0);
  const before = structuredClone(r.result); r.advance(10); r.press(); r.release(); assert.deepEqual(r.result, before);
});
test("skiing pace reacts to slopes without stalling or exceeding the cap", () => {
  const r = started(); let uphill = 0, downhill = 0;
  until(r, () => r.distance >= 65);
  r.distance = 25; r.speed = 9.5; r.advance(0.5); uphill = r.speed;
  r.distance = 55; r.speed = 9.5; r.advance(0.5); downhill = r.speed;
  assert.ok(uphill < 9.5 && uphill > 5); assert.ok(downhill > 9.5); close(r.stats.baseSpeed, 9.5);
});
test("the focus band broadens aim and zone timing without changing the course", () => {
  const a = range(), b = range(started({ band: 2 }));
  assert.ok(b.aim.radius > a.aim.radius); assert.ok(b.timingWindow(b.nextZone).edgeWindow > a.timingWindow(a.nextZone).edgeWindow);
  assert.deepEqual(a.course, b.course); close(new BiathlonRace({ spikes: 2 }).stats.maxSpeed, 15);
});
test("the aim window is forgiving, but still requires timing after settling", () => {
  let hitSamples = 0;
  for (let i = 0; i < 220; i++) if (aimAt(i / 100, 1).centered) hitSamples++;
  assert.ok(hitSamples > 60 && hitSamples < 150);
  assert.ok(aimAt(0, 4).error < aimAt(0, 0).error);
});
test("the simulation agrees at 30 and 120 FPS", () => {
  const a = complete({ good: true, dt: 1 / 30 }), b = complete({ good: true });
  assert.equal(a.counts.Perfect, 6); assert.equal(b.counts.Perfect, 6); close(a.result.time, b.result.time, 0.3);
});
test("skis and poles stay attached, finite and above snow throughout a stride", () => {
  for (let i = 0; i < 100; i++) {
    const r = started(); r.distance = i / 100 * STRIDE * SKIER_SCALE; const p = getSkierPose(r), dots = skierDots(r);
    assert.ok(dots.length < 700 && dots.length > 250);
    assert.ok(dots.every(d => [d.x, d.y, d.z, d.radius].every(Number.isFinite)));
    for (const limb of p.limbs) {
      assert.ok(limb.skiBack.y >= 0 && limb.skiFront.y >= 0 && limb.poleTip.y >= 0);
      close(Math.hypot(limb.skiFront.x - limb.skiBack.x, limb.skiFront.z - limb.skiBack.z), 1.73);
    }
  }
});
test("a planted pole does not skate backwards across the snow", () => {
  const a = started(), b = started(); a.distance = 0.15; b.distance = 0.35;
  const x = getSkierPose(a).limbs[0], y = getSkierPose(b).limbs[0];
  assert.ok(x.planted && y.planted); close(a.distance + x.poleTip.x * SKIER_SCALE, b.distance + y.poleTip.x * SKIER_SCALE);
});
test("the skier tucks downhill, shoulders the rifle at the range and celebrates after the finish", () => {
  const r = started(); r.distance = 60; const tuck = getSkierPose(r); r.distance = 30;
  assert.ok(tuck.head.y < getSkierPose(r).head.y);
  const shooting = range(); shooting.advance(1); const pose = getSkierPose(shooting);
  close(pose.shooting, 1); close(pose.rifle[0].y, pose.rifle[1].y, 0.02);
  const done = complete(); beginFinish(done); advanceFinish(done, 2);
  assert.ok(finishTravel(done) > 0); assert.ok(getSkierPose(done).limbs[0].hand.y > 2);
});

test("finish celebration keeps penalty-adjusted results frozen and saves the correct best", () => {
  const r = complete({ hits: 3 }), result = structuredClone(r.result), time = r.time, distance = r.distance;
  const p = beginFinish(r, r.result.time - 0.5); assert.equal(p.personalBest, false); close(p.value, result.time);
  advanceFinish(r, 6); r.advance(100); close(r.time, time); close(r.distance, distance); assert.deepEqual(r.result, result);
  assert.equal(r.events.filter(e => e === "finish").length, 1);
});
test("normal timing windows reward a human-sized reaction offset", () => {
  const r = started(), z = r.zones[0]; to(r, z.start + 0.6); r.press(); to(r, z.end - 0.4); r.release();
  assert.ok(["Perfect", "Great"].includes(r.lastAttempt.grade)); assert.ok(r.lastAttempt.boost >= 0.1);
});
