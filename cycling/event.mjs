import { CyclingRace, CYCLING_COURSE } from "./engine.mjs?v=sports-1";
import { CyclingScene } from "./scene.mjs?v=sports-1";
import { bankAngle } from "./velodrome.mjs?v=sports-1";

export default { course: CYCLING_COURSE, Race: CyclingRace, Scene: CyclingScene, speedFactor: 3.6,
  noun: "cyclist", event: "RIDE", action: "RIDE", status: "RIDING", finish: "FINISH", storageKey: "dot-cycling-zones-v1",
  handleEvent(event, { clearInput, announce, tone }) {
    if (event.type === "draft") { clearInput(); tone(event.result.grade === "Perfect" ? 1250 : 600); announce(event.result.grade + " drafting release. Slingshot boost " + Math.round(event.result.charge * 12) + " percent."); }
  },
  resultStats: result => [["Draft release", result.drafting?.grade ?? "Miss"], ["Draft charge", Math.round((result.drafting?.charge ?? 0) * 100) + "%"]],
  render(race, scene) {
    if (scene && !scene.viewControls) {
      scene.viewControls = true;
      document.querySelectorAll("[data-camera]").forEach(button => button.addEventListener("click", () => {
        scene.setView(button.dataset.camera);
        document.querySelectorAll("[data-camera]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      }));
    }
    if (race.terminal) return;
    const $ = id => document.getElementById(id);
    $("meet-label").textContent = race.combo ? "STREAK " + race.combo : "VELODROME / 200 M";
    $("phase-note").textContent = race.phase === "line" ? "200 M / FINISH" : bankAngle(race.distance) > 0.5 ? "BANKED BEND" : race.distance > 170 ? "HOME STRAIGHT" : "BACK STRAIGHT";
    if (race.draftWindow) $("phase-note").textContent = "DRAFT GAP / " + race.draftGap.toFixed(1) + " M";
    if (race.draftResult && race.distance < 120) $("feedback").textContent = race.draftResult.grade.toUpperCase() + " DRAFT / +" + (race.draftResult.gain * 3.6).toFixed(1) + " KM/H";
    if (scene?.finishFocus) {
      const p = scene.project(scene.finishFocus.x, scene.finishFocus.y, scene.finishFocus.z);
      $("race-call").style.left = Math.max(80, Math.min(scene.width - 80, p.x)) + "px";
      $("race-call").style.top = Math.max(34, p.y - 28) + "px";
    }
  }
};
