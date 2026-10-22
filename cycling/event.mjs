import { CyclingRace, CYCLING_COURSE } from "./engine.mjs";
import { CyclingScene } from "./scene.mjs?v=track-3";
import { bankAngle } from "./velodrome.mjs?v=track-3";

export default { course: CYCLING_COURSE, Race: CyclingRace, Scene: CyclingScene, speedFactor: 3.6,
  noun: "cyclist", event: "RIDE", action: "RIDE", status: "RIDING", finish: "FINISH", storageKey: "dot-cycling-zones-v1",
  render(race, scene) {
    if (race.terminal) return;
    const $ = id => document.getElementById(id);
    $("meet-label").textContent = race.combo ? "STREAK " + race.combo : "VELODROME / 200 M";
    $("phase-note").textContent = race.phase === "line" ? "200 M / FINISH" : bankAngle(race.distance) > 0.5 ? "BANKED BEND" : race.distance > 170 ? "HOME STRAIGHT" : "BACK STRAIGHT";
    if (scene?.finishFocus) {
      const p = scene.project(scene.finishFocus.x, scene.finishFocus.y, scene.finishFocus.z);
      $("race-call").style.left = Math.max(80, Math.min(scene.width - 80, p.x)) + "px";
      $("race-call").style.top = Math.max(34, p.y - 28) + "px";
    }
  }
};
