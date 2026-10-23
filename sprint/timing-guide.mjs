import { clamp, releaseBands, scoreZone } from "./engine.mjs?v=weather-1";
import { createBoostUI } from "./boost-ui.mjs?v=weather-1";
import { createWeatherUI } from "./weather-ui.mjs?v=weather-1";

export function createTimingGuide({ trigger, tone, finishZone = null, holdKey = null }) {
  const boostUI = createBoostUI(tone);
  const weatherUI = createWeatherUI(tone);
  const guide = document.createElement("div"); guide.className = "timing-guide";
  const label = document.createElement("span"); label.className = "timing-label";
  const track = document.createElement("span"); track.className = "timing-track"; track.setAttribute("aria-hidden", "true");
  const parts = {};
  for (const name of ["zone", "bad", "good", "perfect", "entry", "exit", "marker"]) {
    const part = document.createElement("i"); part.className = "timing-" + name; track.append(part);
    parts[name] = part;
  }
  const entryLabel = document.createElement("b"); entryLabel.className = "timing-entry-label"; entryLabel.textContent = "HOLD";
  const exitLabel = document.createElement("b"); exitLabel.className = "timing-exit-label"; exitLabel.textContent = "RELEASE";
  track.append(entryLabel, exitLabel);
  const countdown = document.createElement("span"); countdown.className = "timing-countdown";
  guide.append(label, track, countdown); document.querySelector(".phases").after(guide);
  const legend = document.createElement("div"); legend.className = "timing-legend";
  for (const [name, text] of [["bad", "BAD"], ["good", "GOOD"], ["perfect", "PERFECT"]]) {
    const item = document.createElement("span"); item.dataset.grade = name; item.textContent = text; legend.append(item);
  }
  guide.after(legend);
  const call = document.getElementById("race-call"), main = document.getElementById("trigger-main"), top = document.getElementById("trigger-top");
  let currentRace, sounded = new Set(), bandKey = null, bands;
  return (race, paused) => {
    weatherUI(race, paused);
    boostUI(race, paused);
    if (currentRace !== race) { currentRace = race; sounded = new Set(); }
    const finishing = race.phase === "line" && finishZone;
    const zone = finishing ? finishZone : race.nextZone;
    const attempt = finishing ? race[holdKey] : race.activeHold?.attempt;
    const active = !!zone && (race.phase === "sprint" || finishing);
    const cue = active ? race.cue : "idle", holding = !!attempt && race.holding;
    guide.dataset.state = paused ? "paused" : cue; guide.dataset.finish = String(!!finishing);
    trigger.dataset.cue = active && !paused ? cue : "idle";
    const text = { prepare: "GET READY", press: "PRESS", hold: "HOLD", release: "RELEASE", lift: "LET GO", run: "NEXT ZONE" }[cue] ?? "TIMING";
    label.textContent = paused ? "PAUSED" : text;
    countdown.textContent = active ? Math.max(0, ((holding ? zone.end : zone.start) - race.distance) / Math.max(race.speed, race.stats.baseSpeed)).toFixed(1) + "s" : "--";
    if (zone) {
      const length = zone.end - zone.start, timing = race.timingWindow(zone, attempt);
      const at = distance => clamp(25 + (distance - zone.start) / length * 50, 0, 100);
      track.style.setProperty("--marker", clamp(at(race.distance), 1, 99) + "%");
      const key = [zone.start, zone.end, attempt?.distance, timing.edgeWindow, timing.perfectEdge, finishing].join(":");
      if (key !== bandKey) { bands = releaseBands({ ...zone, ...timing }, attempt?.distance ?? zone.start, finishing ? race.course.distance : Infinity); bandKey = key; }
      for (const name of ["bad", "good", "perfect"]) {
        const band = bands[name]; parts[name].hidden = !band;
        if (band) { parts[name].style.left = at(band.start) + "%"; parts[name].style.width = (at(band.end) - at(band.start)) + "%"; }
      }
      const grade = holding ? scoreZone({ ...zone, ...timing }, attempt.distance, race.distance).grade : null;
      guide.dataset.grade = grade === "Perfect" ? "perfect" : ["Good", "Great"].includes(grade) ? "good" : "bad";
      if (holding && race.distance >= bands.bad.start) {
        label.textContent = paused ? "PAUSED" : grade === "Perfect" ? "PERFECT" : ["Good", "Great"].includes(grade) ? "GOOD" : race.distance > zone.end ? "TOO LATE" : "TOO EARLY";
      }
    } else {
      for (const name of ["bad", "good", "perfect"]) parts[name].hidden = true;
      track.style.setProperty("--marker", "1%");
    }
    if (!active || paused) return;
    if (["prepare", "press", "hold", "release", "lift"].includes(cue)) {
      main.textContent = { prepare: "GET\nREADY", press: "PRESS &\nHOLD", hold: "HOLD", release: "RELEASE", lift: "LET GO" }[cue];
      top.textContent = finishing ? "FINAL ACTION" : { prepare: "UP NEXT", press: "ENTRY", hold: "IN ZONE", release: "EXIT", lift: "RESET" }[cue];
      trigger.setAttribute("aria-label", text + (finishing ? ". Final action." : ". Zone " + zone.id + "."));
      if (["prepare", "press", "release"].includes(cue)) {
        call.textContent = text; call.className = "race-call";
        call.style.color = cue === "prepare" ? "#ffd473" : cue === "release" ? { perfect: "#81f6b6", good: "#ffd473", bad: "#ed667d" }[guide.dataset.grade] : "#f4fff4";
      }
    }
    const key = (finishing ? "finish" : zone.id) + ":" + cue;
    if (["press", "release"].includes(cue) && !sounded.has(key)) {
      sounded.add(key); tone(cue === "press" ? 620 : 900, 0.06);
    }
  };
}
