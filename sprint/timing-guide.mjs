import { clamp } from "./engine.mjs";

export function createTimingGuide({ trigger, tone, finishZone = null, holdKey = null }) {
  const guide = document.createElement("div"); guide.className = "timing-guide";
  const label = document.createElement("span"); label.className = "timing-label";
  const track = document.createElement("span"); track.className = "timing-track"; track.setAttribute("aria-hidden", "true");
  for (const name of ["zone", "entry", "exit", "marker"]) {
    const part = document.createElement("i"); part.className = "timing-" + name; track.append(part);
  }
  const countdown = document.createElement("span"); countdown.className = "timing-countdown";
  guide.append(label, track, countdown); document.querySelector(".phases").after(guide);
  const call = document.getElementById("race-call"), main = document.getElementById("trigger-main"), top = document.getElementById("trigger-top");
  let currentRace, sounded = new Set();
  return (race, paused) => {
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
      track.style.setProperty("--marker", clamp(25 + (race.distance - zone.start) / length * 50, 1, 99) + "%");
      track.style.setProperty("--window", Math.min(48, timing.perfectEdge / length * 100) + "%");
    }
    if (!active || paused) return;
    if (["prepare", "press", "hold", "release", "lift"].includes(cue)) {
      main.textContent = { prepare: "GET\nREADY", press: "PRESS &\nHOLD", hold: "HOLD", release: "RELEASE", lift: "LET GO" }[cue];
      top.textContent = finishing ? "FINAL ACTION" : { prepare: "UP NEXT", press: "ENTRY", hold: "IN ZONE", release: "EXIT", lift: "RESET" }[cue];
      trigger.setAttribute("aria-label", text + (finishing ? ". Final action." : ". Zone " + zone.id + "."));
      if (["prepare", "press", "release"].includes(cue)) {
        call.textContent = text; call.className = "race-call";
        call.style.color = cue === "prepare" ? "#ffd473" : "#d9fcff";
      }
    }
    const key = (finishing ? "finish" : zone.id) + ":" + cue;
    if (["press", "release"].includes(cue) && !sounded.has(key)) {
      sounded.add(key); tone(cue === "press" ? 620 : 900, 0.06);
    }
  };
}
