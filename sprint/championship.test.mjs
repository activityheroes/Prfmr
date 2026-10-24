import test from "node:test";
import assert from "node:assert/strict";
import { MEETS, EVENTS, eventPoints, newMeet, readMeet, saveMeet, prepareMeet, submitMeet, standings } from "./championship.mjs";
import { SprintRace } from "./engine.mjs";

test("event points normalize all sports, include time penalties, and reject fouls", () => {
  for (const [id, event] of Object.entries(EVENTS)) {
    const result = { mark: event.target, time: event.target };
    assert.equal(eventPoints(id, result), 800);
    assert.equal(eventPoints(id, { ...result, foul: true }), 0);
    assert.equal(eventPoints(id, { ...result, cleared: false }), 0);
    assert.equal(eventPoints(id, { mark: Infinity, time: NaN }), 0);
  }
  assert.ok(eventPoints("biathlon", { time: 50 }) < eventPoints("biathlon", { time: 48 }));
  assert.equal(eventPoints("sprint", { time: 1 }), 1000);
});
test("meets resume, record each bound round once, count failures, and reach a deterministic podium", () => {
  const oldStorage = globalThis.localStorage, oldLocation = globalThis.location, data = new Map();
  globalThis.localStorage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  try {
    const meet = newMeet("summer", 42); saveMeet(meet);
    globalThis.location = { search: "?meet=" + meet.id };
    const race = new SprintRace(); prepareMeet(race); assert.equal(race.meetTicket.round, 0);
    const retry = new SprintRace(); prepareMeet(retry); assert.deepEqual(race.weather, retry.weather);
    assert.equal(submitMeet(race), false);
    for (const [round, id] of MEETS.summer.events.entries()) {
      const r = { course: { id }, terminal: true, result: { time: 10, mark: 8, foul: round === 1 }, meetTicket: { id: meet.id, round } };
      assert.equal(submitMeet({ ...r, meetTicket: { id: "stale", round } }), false);
      assert.equal(submitMeet(r), true); assert.equal(submitMeet(r), false);
      assert.equal(readMeet().rounds.length, round + 1);
    }
    const saved = readMeet(); assert.equal(saved.rounds[1].points, 0);
    const rows = standings(saved); assert.equal(rows.length, 4); assert.deepEqual(rows, standings(saved));
    assert.ok(rows.every((r, i) => i === 0 || r.total <= rows[i - 1].total));
    assert.equal(submitMeet(retry), false);
    const untouched = new SprintRace(); prepareMeet(untouched); assert.equal(untouched.meetTicket, undefined);
    globalThis.localStorage.setItem = () => { throw new Error("Quota exceeded"); }; assert.equal(saveMeet(newMeet("winter")), false);
    data.set("dot-championship-v1", '{"version":1,"key":"fake"}'); assert.equal(readMeet(), null);
  } finally { globalThis.localStorage = oldStorage; globalThis.location = oldLocation; }
});
