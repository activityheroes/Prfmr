import { RhythmRace, longZones } from "../sprint/engine.mjs?v=zones-2";

export const CYCLING_COURSE = {
  id: "cycling", distance: 200, finishAt: 197, fatigueAt: 180, finishMove: false,
  baseSpeed: 15, rollingSpeed: 10, acceleration: 9, maxSpeeds: [21, 22.5, 24],
  zones: longZones([[30, 70], [120, 164]], 15)
};

export class CyclingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, CYCLING_COURSE); }
}
