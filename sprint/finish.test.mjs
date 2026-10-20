import test from "node:test";
import assert from "node:assert/strict";
import { SprintRace } from "./engine.mjs";
import { CyclingRace } from "../cycling/engine.mjs";
import { SwimmingRace } from "../swimming/engine.mjs";
import { JavelinRace } from "../javelin/engine.mjs";
import { LongJumpRace } from "../long-jump/engine.mjs";
import { PoleVaultRace } from "../pole-vault/engine.mjs";
import { HighJumpRace } from "../high-jump/engine.mjs";
import { HurdlesRace } from "../hurdles/engine.mjs";
import { jumperDots as highJumperDots } from "../high-jump/jumper.mjs";
import { jumperDots } from "../long-jump/jumper.mjs";
import { vaulterDots } from "../pole-vault/vaulter.mjs";
import { getRunnerPose, drawRunner } from "./runner.mjs";
import { CYCLIST_ART } from "../cycling/cyclist.mjs";
import { SWIMMER_ART } from "../swimming/swimmer.mjs";
import { THROWER_ART } from "../javelin/thrower.mjs";
import { beginFinish, advanceFinish, canShowResult, finishTravel, reactionPose } from "./finish.mjs";

function to(race, distance) {
  for (let i = 0; i < 20000 && race.distance < distance && !race.terminal; i++)
    race.advance(Math.min(1 / 120, Math.max(0.00001, (distance - race.distance) / Math.max(race.speed, 1))));
  assert.ok(race.distance >= distance || race.terminal);
}
function completed(Race, valid = true, height) {
  const race = [PoleVaultRace, HighJumpRace].includes(Race) ? new Race({}, height) : new Race(); race.press(); race.release();
  for (const zone of race.zones) { to(race, zone.start); race.press(); to(race, zone.end); race.release(); }
  if (valid && race.finishZone) {
    to(race, race.finishZone.start); race.press(); to(race, race.finishZone.end); race.release();
  }
  for (let i = 0; i < 10000 && !race.terminal; i++) race.advance(1 / 120);
  assert.ok(race.terminal);
  return race;
}

for (const Race of [SprintRace, CyclingRace, SwimmingRace, JavelinRace, LongJumpRace, PoleVaultRace, HighJumpRace, HurdlesRace]) {
  test(`${Race.name}: reaction clock leaves the official result and physical landing unchanged`, () => {
    const race = completed(Race), result = structuredClone(race.result);
    const physical = JSON.stringify([race.time, race.distance, race.athlete, race.projectile, race.landing]);
    const p = beginFinish(race);
    assert.equal(p.success, true); assert.equal(p.personalBest, true);
    assert.equal(canShowResult(race), false);
    assert.equal(beginFinish(race), p);
    advanceFinish(race, p.skipAt - 0.01); assert.equal(canShowResult(race), false);
    advanceFinish(race, 0.02); assert.equal(canShowResult(race), true);
    for (const dt of [NaN, Infinity, -1, 0]) assert.equal(advanceFinish(race, dt), false);
    assert.equal(advanceFinish(race, p.duration), true);
    race.advance(10); race.press(); race.release();
    assert.deepEqual(race.result, result);
    assert.equal(JSON.stringify([race.time, race.distance, race.athlete, race.projectile, race.landing]), physical);
    assert.equal(race.events.filter(e => e === "finish").length, 1);
    assert.ok(finishTravel(race) < 5);
    const travel = finishTravel(race); advanceFinish(race, 10); assert.equal(finishTravel(race), travel);
  });
}

test("there is no reaction or result skip before the event has actually finished", () => {
  const race = new JavelinRace();
  assert.equal(beginFinish(race), undefined); assert.equal(canShowResult(race), false);
  assert.equal(advanceFinish(race, 10), false);
});
test("javelin holds the impact shot before returning to the thrower's reaction", () => {
  const race = completed(JavelinRace), p = beginFinish(race);
  assert.equal(race.projectile.y, 0); assert.ok(p.reactionAt >= 3);
  assert.ok(p.duration - p.reactionAt >= 2);
});
test("personal best uses lower race time but higher field mark; fouls never qualify", () => {
  for (const Race of [SprintRace, JavelinRace, LongJumpRace, PoleVaultRace, HighJumpRace]) {
    const race = completed(Race), value = race.result.mark ?? race.result.time;
    assert.equal(beginFinish(race, value).personalBest, false);
    delete race.presentation;
    assert.equal(beginFinish(race, value + (Race === SprintRace ? 1 : -1)).personalBest, true);
  }
  for (const Race of [JavelinRace, LongJumpRace, PoleVaultRace, HighJumpRace]) {
    const race = completed(Race, false), p = beginFinish(race);
    assert.equal(p.success, false); assert.equal(p.personalBest, false);
    assert.equal(race.result.mark, null);
  }
});
test("raised arms and disappointed poses are distinct and keep both feet planted", () => {
  const base = getRunnerPose(0, 0, true), happy = reactionPose(base, 1.2, true), failed = reactionPose(base, 1.2, false);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(happy.limbs[i].foot, base.limbs[i].foot);
    assert.deepEqual(failed.limbs[i].foot, base.limbs[i].foot);
    assert.ok(happy.limbs[i].hand.y < happy.head.y);
    assert.ok(failed.limbs[i].hand.y > failed.shoulder.y);
  }
  assert.ok(failed.head.y > happy.head.y);
  assert.notDeepEqual(reactionPose(base, 1.2, true), reactionPose(base, 1.5, true));
});
test("sand and mat recovery poses remain finite and fit the dot instance budget", () => {
  for (const [Race, dots, height] of [[LongJumpRace, jumperDots, 3.5], [PoleVaultRace, vaulterDots, 3.5], [PoleVaultRace, vaulterDots, 5.5], [HighJumpRace, highJumperDots, 1.65], [HighJumpRace, highJumperDots, 2.5]]) {
    const race = completed(Race, true, height), mark = race.result.mark;
    beginFinish(race);
    for (let i = 0; i < 260; i++) {
      advanceFinish(race, 1 / 60); const points = dots(race);
      assert.ok(points.length > 80 && points.length <= 260, String(points.length));
      assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y >= 0));
    }
    assert.equal(race.result.mark, mark);
  }
});

for (const [Race, art] of [
  [SprintRace, { width: 256, height: 256, x: 104, ground: 238, unit: 12, draw: drawRunner }],
  [CyclingRace, CYCLIST_ART], [SwimmingRace, SWIMMER_ART], [JavelinRace, THROWER_ART]
]) {
  test(`${Race.name}: raised hands and all reaction dots remain inside the texture`, () => {
    const race = completed(Race); beginFinish(race);
    let matrix = [1, 0, 0, 1, 0, 0], dots = 0; const stack = [];
    const multiply = ([a, b, c, d, e, f]) => {
      const [A, B, C, D, E, F] = matrix;
      matrix = [A*a+C*b, B*a+D*b, A*c+C*d, B*c+D*d, A*e+C*f+E, B*e+D*f+F];
    };
    const ctx = {
      save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); },
      translate(x, y) { multiply([1, 0, 0, 1, x, y]); }, scale(x, y) { multiply([x, 0, 0, y, 0, 0]); },
      rotate(t) { multiply([Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0]); },
      beginPath() {}, fill() {}, fillRect() {},
      arc(x, y, radius) {
        const [a, b, c, d, e, f] = matrix, px = a*x+c*y+e, py = b*x+d*y+f, r = Math.hypot(a, b)*radius;
        assert.ok(px-r >= 0 && px+r <= art.width && py-r >= 0 && py+r <= art.height, JSON.stringify({ px, py, r }));
        dots++;
      }
    };
    for (let i = 0; i < 160; i++) {
      const view = Object.create(race); view.distance = race.distance + finishTravel(race);
      art.draw(ctx, art.x, art.ground, art.unit, view); advanceFinish(race, 0.04);
    }
    assert.ok(dots > 10000);
  });
}
