import { RhythmRace } from "../sprint/engine.mjs?v=boost-1";

export const CYCLING_COURSE = {
  id: "cycling", distance: 200, finishAt: 197, fatigueAt: 180, finishMove: false,
  baseSpeed: 15, rollingSpeed: 10, acceleration: 9, maxSpeeds: [21, 22.5, 24],
  zones: [30, 60, 90, 120, 150, 180].map((start, index) => ({
    id: index + 1, start, end: start + (index === 5 ? 7 : 10),
    edgeWindow: index === 5 ? 1.35 : 2.4, perfectEdge: index === 5 ? 0.195 : 0.375
  }))
};

export class CyclingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, CYCLING_COURSE); }
}
