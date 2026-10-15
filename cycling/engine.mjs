import { RhythmRace } from "../sprint/engine.mjs";

export const CYCLING_COURSE = {
  id: "cycling", distance: 200, finishAt: 197, fatigueAt: 180, finishMove: false,
  baseSpeed: 12, acceleration: 6, maxSpeeds: [16.8, 18, 19.2],
  zones: [30, 60, 90, 120, 150, 180].map((start, index) => ({
    id: index + 1, start, end: start + (index === 5 ? 4.5 : 7.5),
    edgeWindow: index === 5 ? 1.35 : 2.4, perfectEdge: index === 5 ? 0.195 : 0.375
  }))
};

export class CyclingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, CYCLING_COURSE); }
}
