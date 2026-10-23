import { RhythmRace, longZones } from "../sprint/engine.mjs?v=zones-2";

export const SWIMMING_COURSE = {
  id: "swimming", distance: 50, finishAt: 49, fatigueAt: 45, finishMove: false,
  baseSpeed: 1.9, acceleration: 2.3, maxSpeeds: [2.65, 2.8, 2.95],
  // Keep the same rewards and carry-over, scaled to a swimmer's baseline speed.
  momentumScale: 1.9 / 8,
  zones: longZones([[7.5, 15.5], [30, 38.5]], 1.9)
};
export class SwimmingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, SWIMMING_COURSE); }
}
