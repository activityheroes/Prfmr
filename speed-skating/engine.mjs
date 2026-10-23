import { RhythmRace } from "../sprint/engine.mjs?v=zones-2";
import { SKATING_COURSE } from "./course.mjs?v=zones-2";
export { SKATING_COURSE, OVAL, ovalPoint, bendAmount } from "./course.mjs?v=zones-2";
export class SpeedSkatingRace extends RhythmRace {
  constructor(loadout = {}) { super(loadout, SKATING_COURSE); }
}
