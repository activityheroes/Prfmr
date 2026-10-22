import { SpeedSkatingRace, SKATING_COURSE, ovalPoint } from "./engine.mjs?v=boost-1";
import { SkatingScene } from "./scene.mjs?v=boost-1";
export default { course: SKATING_COURSE, Race: SpeedSkatingRace, Scene: SkatingScene, speedFactor: 3.6,
  noun: "skater", event: "SKATE", action: "GLIDE", status: "SKATING", finish: "FINISH", storageKey: "dot-speed-skating-zones-v1",
  render(race, scene) {
    if (race.terminal) return;
    const $ = id => document.getElementById(id), turn = ovalPoint(race.distance).bend;
    $("meet-label").textContent = race.combo ? "STREAK " + race.combo : "WINTER / 500 M";
    $("phase-note").textContent = race.phase === "line" ? "500 M / THE LINE" : turn ? "BEND / CROSSOVER" : "STRAIGHT / POWER GLIDE";
    if (scene?.finishFocus) { const p = scene.project(scene.finishFocus.x, scene.finishFocus.y, scene.finishFocus.z); $("race-call").style.left = Math.max(80, Math.min(scene.width - 80, p.x)) + "px"; $("race-call").style.top = Math.max(10, p.y - 28) + "px"; }
  }
};
