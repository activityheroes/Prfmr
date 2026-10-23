import { RhythmRace } from "../sprint/engine.mjs?v=weather-1";
import { SKATING_COURSE } from "./course.mjs?v=weather-1";
export { SKATING_COURSE, OVAL, ovalPoint, bendAmount } from "./course.mjs?v=weather-1";
export class SpeedSkatingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, SKATING_COURSE); }
}
