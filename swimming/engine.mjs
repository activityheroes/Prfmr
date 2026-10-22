import { RhythmRace } from "../sprint/engine.mjs?v=boost-1";

export const SWIMMING_COURSE = {
  id: "swimming", distance: 50, finishAt: 49, fatigueAt: 45, finishMove: false,
  baseSpeed: 1.9, acceleration: 2.3, maxSpeeds: [2.65, 2.8, 2.95],
  // Keep the same rewards and carry-over, scaled to a swimmer's baseline speed.
  momentumScale: 1.9 / 8,
  zones: [7.5, 15, 22.5, 30, 37.5, 45].map((start, index) => ({
    id: index + 1, start, end: start + (index === 5 ? 0.75 : 1.25),
    edgeWindow: index === 5 ? 0.225 : 0.4, perfectEdge: index === 5 ? 0.0325 : 0.0625
  }))
};
export class SwimmingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, SWIMMING_COURSE); }
}
