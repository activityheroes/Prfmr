import { SwimmingRace, SWIMMING_COURSE } from "./engine.mjs?v=starts-1";
import { SwimmingScene } from "./scene.mjs?v=starts-1";
import { SWIMMER_ART } from "./swimmer.mjs?v=starts-1";

export default { course: SWIMMING_COURSE, Race: SwimmingRace, Scene: SwimmingScene, athlete: SWIMMER_ART,
  noun: "swimmer", event: "SWIM", action: "SWIM", status: "SWIMMING", finish: "THE WALL", storageKey: "dot-swimming-zones-v1",
  handleEvent(event, { clearInput, announce, tone }) {
    if (event === "turn") { clearInput(); tone(700); announce("Wall turn. Tap once when the marker reaches green to push off."); }
    if (event === "push-off") { clearInput(); tone(980); announce("Push off. Return length."); }
    if (event.type === "turn-timing") { tone(event.result.grade === "Perfect" ? 1200 : 600); announce(event.result.grade + " wall timing."); }
  },
  resultStats: result => [["Wall push-off", result.turn?.grade ?? "Miss"], ["Lengths", "2 x 25 m"]],
  render(race) {
    document.getElementById("phase-note").textContent = race.turned ? "RETURN / LENGTH 2 OF 2" : "OUTBOUND / LENGTH 1 OF 2";
    if (race.phase === "dive") {
      document.getElementById("trigger").disabled = true;
      document.getElementById("trigger-main").textContent = "DIVING";
      document.getElementById("trigger-top").textContent = "START";
      document.getElementById("trigger-bottom").textContent = "AUTOMATIC";
    }
  }
};
