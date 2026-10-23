import { HurdlesRace, HURDLES_COURSE } from "./engine.mjs?v=rivals-1";
import { HurdlesScene } from "./scene.mjs?v=rivals-1";

export default { course: HURDLES_COURSE, Race: HurdlesRace, Scene: HurdlesScene,
  noun: "hurdler", event: "HURDLES", action: "RUN", status: "RUNNING", finish: "FINISH", storageKey: "dot-hurdles-zones-v1",
  resultStats: result => [["Hurdles cleared", result.cleared + " / 10"], ["Hurdles clipped", String(result.hits)]],
  render(race, scene) {
    const $ = id => document.getElementById(id);
    $("zone-count").textContent = "CLEAR " + race.cleared + " / 10";
    if (race.terminal) return;
    const hit = race.stumbleAt !== null && race.time - race.stumbleAt < 0.55;
    const cleared = race.lastClearAt !== null && race.time - race.lastClearAt < 0.35;
    $("phase-note").textContent = "10 HURDLES / " + race.hits + " CLIPPED";
    if (race.phase !== "ready" && race.phase !== "line") {
      if (race.cue === "release") { $("trigger-main").textContent = "RELEASE"; $("trigger-top").textContent = "TAKEOFF"; }
      if (hit || cleared) {
        $("race-call").textContent = hit ? "HURDLE CLIPPED" : "CLEAR!";
        $("race-call").style.color = hit ? "#ff7f86" : "#81f6b6";
        $("feedback").textContent = hit ? "MOMENTUM LOST" : "CLEAN CLEARANCE";
      }
      if (race.jump && race.cue === "run") {
        $("trigger-main").textContent = "CLEAR\nTHE BAR"; $("trigger-top").textContent = "HURDLE " + race.jump.id;
        $("trigger-bottom").textContent = "IN FLIGHT";
      }
    }
    if (scene?.finishFocus) {
      const p = scene.project(scene.finishFocus.x, scene.finishFocus.y, scene.finishFocus.z);
      $("race-call").style.left = Math.max(80, Math.min(scene.width - 80, p.x)) + "px";
      $("race-call").style.top = Math.max(8, p.y - 30) + "px";
    }
  }
};
