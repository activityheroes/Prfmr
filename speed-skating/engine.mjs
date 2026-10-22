import { RhythmRace } from "../sprint/engine.mjs?v=boost-1";
import { SKATING_COURSE } from "./course.mjs";
export { SKATING_COURSE, OVAL, ovalPoint, bendAmount } from "./course.mjs";
export class SpeedSkatingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, SKATING_COURSE); }
}
